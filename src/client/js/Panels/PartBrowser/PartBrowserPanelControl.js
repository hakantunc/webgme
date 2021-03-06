/*globals define, _, requirejs, WebGMEGlobal*/

define(['logManager',
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames',
    'js/RegistryKeys',
    'js/Utils/METAAspectHelper',
    'js/Utils/PreferencesHelper'], function (logManager,
                             CONSTANTS,
                             GMEConcepts,
                             nodePropertyNames,
                             REGISTRY_KEYS,
                             METAAspectHelper,
                             PreferencesHelper) {
    "use strict";

    var PartBrowserControl,
        WIDGET_NAME = 'PartBrowser',
        DEFAULT_DECORATOR = "ModelDecorator";

    PartBrowserControl = function (myClient, myPartBrowserView) {
        var self = this;

        this._client = myClient;
        this._partBrowserView = myPartBrowserView;

        //the ID of the node whose valid children types should be displayed
        this._containerNodeId = null;

        //the ID of the valid children types of the container node
        this._validChildrenTypeIDs = [];

        //decorators can use it to ask for notifications about their registered sub IDs
        this._componentIDPartIDMap = {};

        //by default handle the 'All' aspect
        this._aspect = CONSTANTS.ASPECT_ALL;

        this._initDragDropFeatures();

        this._logger = logManager.create("PartBrowserControl");
        this._logger.debug("Created");

        METAAspectHelper.addEventListener(METAAspectHelper.events.META_ASPECT_CHANGED, function () {
            self._processContainerNode(self._containerNodeId);
        });

        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_OBJECT, function (model, activeObject) {
            self.selectedObjectChanged(activeObject);
        });

        WebGMEGlobal.State.on('change:' + CONSTANTS.STATE_ACTIVE_ASPECT, function (model, activeAspect) {
            self.selectedAspectChanged(activeAspect);
        });
    };

    PartBrowserControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this;

        this._logger.debug("activeObject: '" + nodeId + "'");

        //remove current territory patterns
        if (this._territoryId) {
            this._client.removeUI(this._territoryId);
            this._partBrowserView.clear();
        }

        this._containerNodeId = nodeId;
        this._validChildrenTypeIDs = [];

        this._aspect = WebGMEGlobal.State.getActiveAspect();

        if (this._containerNodeId || this._containerNodeId === CONSTANTS.PROJECT_ROOT_ID) {
            //put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = { "children": 0 };

            if (this._aspect !== CONSTANTS.ASPECT_ALL) {
                //make sure that the _aspect exist in the node, otherwise fallback to All
                var aspectNames = this._client.getMetaAspectNames(nodeId) || [];
                if (aspectNames.indexOf(this._aspect) === -1) {
                    this._logger.warning('The currently selected aspect "' + this._aspect + '" does not exist in the object "' + nodeId + '", falling back to "All"');
                    this._aspect = CONSTANTS.ASPECT_ALL;
                }
            }

            this._territoryId = this._client.addUI(this, function (events) {
                self._eventCallback(events);
            });
            //update the territory
            this._logger.debug('UPDATING TERRITORY: selectedObjectChanged' + JSON.stringify(this._selfPatterns));
            this._client.updateTerritory(this._territoryId, this._selfPatterns);
        }
    };

    PartBrowserControl.prototype._getObjectDescriptor = function (nodeId) {
        var nodeObj = this._client.getNode(nodeId),
            objDescriptor;

        if (nodeObj) {
            objDescriptor = {};

            objDescriptor.id = nodeObj.getId();
            objDescriptor.decorator = nodeObj.getRegistry(REGISTRY_KEYS.DECORATOR) || DEFAULT_DECORATOR;
            objDescriptor.name = nodeObj.getAttribute(nodePropertyNames.Attributes.name);
        }

        return objDescriptor;
    };

    PartBrowserControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
            e;

        this._logger.debug("_eventCallback '" + i + "' items, events: " + JSON.stringify(events));

        while (i--) {
            e = events[i];
            switch (e.etype) {
                case CONSTANTS.TERRITORY_EVENT_LOAD:
                    this._onLoad(e.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UPDATE:
                    this._onUpdate(e.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                    this._onUnload(e.eid);
                    break;
            }
        }

        this._updateValidChildrenTypeDecorators();

        this._logger.debug("_eventCallback '" + events.length + "' items - DONE");
    };

    // PUBLIC METHODS
    PartBrowserControl.prototype._onLoad = function (gmeID) {
        if (this._containerNodeId === gmeID) {
            this._processContainerNode(gmeID);
        }
    };

    PartBrowserControl.prototype._onUpdate = function (gmeID) {
        if (this._containerNodeId === gmeID) {
            this._processContainerNode(gmeID);
        }
    };

    PartBrowserControl.prototype._onUnload = function (gmeID) {
        if (this._containerNodeId === gmeID) {
            this._logger.warning('Container node got unloaded...');
            this._validChildrenTypeIDs = [];
            this._partBrowserView.clear();
        }
    };

    PartBrowserControl.prototype._processContainerNode = function (gmeID) {
        var node = this._client.getNode(gmeID),
            validChildrenTypes = [],
            oValidChildrenTypes = this._validChildrenTypeIDs.slice(0),
            len,
            diff,
            id,
            territoryChanged = false;

        if (node) {
            //get possible targets from MetaDescriptor
            validChildrenTypes = GMEConcepts.getMETAAspectMergedValidChildrenTypes(gmeID);

            //the deleted ones
            diff = _.difference(oValidChildrenTypes, validChildrenTypes);
            len = diff.length;
            while (len--) {
                id = diff[len];
                this._removePart(id);

                //remove it from the territory
                //only if not itself, then we need to keep it in the territory
                if (id !== gmeID) {
                    delete this._selfPatterns[id];
                    territoryChanged = true;
                }
            }

            //check the added ones
            diff = _.difference(validChildrenTypes, oValidChildrenTypes);
            len = diff.length;
            while (len--) {
                id = diff[len];
                if (this._validChildrenTypeIDs.indexOf(id) === -1) {
                    this._validChildrenTypeIDs.push(id);

                    //add to the territory
                    //only if not self, because it's already in the territory
                    if (id !== gmeID) {
                        this._selfPatterns[id] = { "children": 0 };
                        territoryChanged = true;
                    }
                }
            }

            //update the territory
            if (territoryChanged) {
                this._doUpdateTerritory(true);
            }
        }
    };

    PartBrowserControl.prototype._doUpdateTerritory = function (async) {
        var territoryId = this._territoryId,
            patterns = this._selfPatterns,
            client = this._client,
            logger = this._logger;

        if (async === true) {
            setTimeout(function () {
                logger.debug('Updating territory with rules: ' + JSON.stringify(patterns));
                client.updateTerritory(territoryId, patterns);
            }, 10);
        } else {
            logger.debug('Updating territory with rules: ' + JSON.stringify(patterns));
            client.updateTerritory(territoryId, patterns);
        }
    };


    PartBrowserControl.prototype._getItemDecorator = function (decorator) {
        var result;

        result = this._client.decoratorManager.getDecoratorForWidget(decorator, WIDGET_NAME);
        if (!result) {
            result = this._client.decoratorManager.getDecoratorForWidget(DEFAULT_DECORATOR, WIDGET_NAME);
        }

        return result;
    };


    PartBrowserControl.prototype._getPartDescriptor = function (id) {
        var desc = this._getObjectDescriptor(id);

        desc.decoratorClass = this._getItemDecorator(desc.decorator);
        desc.control = this;
        desc.metaInfo = {};
        desc.metaInfo[CONSTANTS.GME_ID] = id;
        desc.preferencesHelper = PreferencesHelper.getPreferences();
        desc.aspect = this._aspect;

        return desc;
    };

    PartBrowserControl.prototype.registerComponentIDForPartID = function (componentID, partId) {
        this._componentIDPartIDMap[componentID] = this._componentIDPartIDMap[componentID] || [];
        if (this._componentIDPartIDMap[componentID].indexOf(partId) === -1) {
            this._componentIDPartIDMap[componentID].push(partId);
        }
    };

    PartBrowserControl.prototype.unregisterComponentIDFromPartID = function (componentID, partId) {
        var idx;

        if (this._componentIDPartIDMap && this._componentIDPartIDMap[componentID]) {
           idx = this._componentIDPartIDMap[componentID].indexOf(partId);
            if (idx !== -1) {
                this._componentIDPartIDMap[componentID].splice(idx, 1);

                if (this._componentIDPartIDMap[componentID].length === 0) {
                    delete this._componentIDPartIDMap[componentID];
                }
            }
        }
    };


    PartBrowserControl.prototype._initDragDropFeatures = function () {
        var dragEffects = this._partBrowserView.DRAG_EFFECTS;

        this._partBrowserView.getDragEffects = function (/*el*/) {
            return [dragEffects.DRAG_CREATE_INSTANCE];
        };

        this._partBrowserView.getDragItems = function (el) {
            return [el.attr('id')];
        };
    };


    PartBrowserControl.prototype._removePart = function (id) {
        var idx;

        //remove from the UI
        this._partBrowserView.removePart(id);

        //fix accounting
        idx = this._validChildrenTypeIDs.indexOf(id);
        this._validChildrenTypeIDs.splice(idx, 1);
    };


    PartBrowserControl.prototype._updateValidChildrenTypeDecorators = function () {
        var len = this._validChildrenTypeIDs.length,
            decorators = [DEFAULT_DECORATOR],
            self = this,
            dec;

        while (len--) {
            dec = this._getObjectDescriptor(this._validChildrenTypeIDs[len]).decorator;
            if (decorators.indexOf(dec) === -1) {
                decorators.push(dec);
            }
        }

        if (decorators.length > 0) {
            this._client.decoratorManager.download(decorators, WIDGET_NAME, function () {
                self._refreshPartList();
            });
        }
    };


    PartBrowserControl.prototype._refreshPartList = function () {
        var childrenTypeToDisplay = [],
            i,
            id,
            names = [],
            mapNameID = {},
            objDesc,
            childrenWithName,
            decoratorInstance,
            j,
            getDecoratorTerritoryQueries,
            territoryChanged = false,
            _selfPatterns = this._selfPatterns,
            partEnabled,
            _aspectTypes = undefined;

        getDecoratorTerritoryQueries = function (decorator) {
            var query,
                entry;

            if (decorator) {
                query = decorator.getTerritoryQuery();

                if (query) {
                    for (entry in query) {
                        if (query.hasOwnProperty(entry)) {
                            _selfPatterns[entry] = query[entry];
                            territoryChanged = true;
                        }
                    }
                }
            }
        };

        this._logger.debug('_refreshPartList this._validChildrenTypeIDs: ' + this._validChildrenTypeIDs);

        //clear view
        this._partBrowserView.clear();

        //set aspect types
        if (this._aspect !== CONSTANTS.ASPECT_ALL) {
            var metaAspectDesc = this._client.getMetaAspect(this._containerNodeId, this._aspect);
            if (metaAspectDesc) {
                //metaAspectDesc.items contains the children types the user specified to participate in this aspect
                _aspectTypes =  metaAspectDesc.items || [];
            }
        }

        //filter out the types that doesn't need to be displayed for whatever reason:
        // - don't display validConnectionTypes
        // - don't display abstract items
        // - bcos they are not in the current aspects META rules
        i = this._validChildrenTypeIDs.length;
        while (i--) {
            id = this._validChildrenTypeIDs[i];
            if (GMEConcepts.isConnectionType(id) === false &&
                GMEConcepts.isAbstract(id) === false) {

                if (_aspectTypes) {
                    //user defined aspect
                    //check if 'id' is descendant of any user defined aspect type
                    j = _aspectTypes.length;
                    while (j--) {
                        if (this._client.isTypeOf(id, _aspectTypes[j])) {
                            childrenTypeToDisplay.push(id);
                            break;
                        }
                    }
                } else {
                    childrenTypeToDisplay.push(id);
                }

                if (childrenTypeToDisplay.indexOf(id) !== -1) {
                    objDesc = this._getObjectDescriptor(id);
                    if (names.indexOf(objDesc.name) === -1) {
                        names.push(objDesc.name);
                        mapNameID[objDesc.name] = [id];
                    } else {
                        mapNameID[objDesc.name].push(id);
                    }
                }
            }
        }

        this._logger.debug('_refreshPartList childrenTypeToDisplay: ' + childrenTypeToDisplay);

        //sort the parts by name
        names.sort();
        names.reverse();

        //display the parts in the order of their names
        i = names.length;
        while (i--) {
            childrenWithName = mapNameID[names[i]];
            childrenWithName.sort();
            childrenWithName.reverse();
            this._logger.debug(names[i] + ':  ' + childrenWithName);

            j = childrenWithName.length;
            while (j--) {
                id = childrenWithName[j];
                decoratorInstance = this._partBrowserView.addPart(id, this._getPartDescriptor(id));
                getDecoratorTerritoryQueries(decoratorInstance);
            }
        }

        //update child creation possibility
        i = this._validChildrenTypeIDs.length;
        while (i--) {
            id = this._validChildrenTypeIDs[i];
            partEnabled = GMEConcepts.canCreateChild(this._containerNodeId, id);
            this._partBrowserView.setEnabled(id, partEnabled);
        }

        if (territoryChanged) {
            this._doUpdateTerritory(true);
        }
    };


    PartBrowserControl.prototype.selectedAspectChanged = function (aspect) {
        if (this._aspect !== aspect) {
            this._aspect = aspect;

            this._logger.debug("activeAspect: '" + aspect + "'");

            this._refreshPartList();
        }
    };


    return PartBrowserControl;
});