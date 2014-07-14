/*globals define*/
define(['eventDispatcher'], function (EventDispatcher) {

    "use strict";

    var SnapEditorWidgetEventDispatcher;

    SnapEditorWidgetEventDispatcher = function () {
    };

    SnapEditorWidgetEventDispatcher.prototype._addEventDispatcherExtensions = function () {
        //event functions to relay information between users
        $.extend(this, new EventDispatcher());

        this.events = {
            "ITEM_POSITION_CHANGED": "ITEM_POSITION_CHANGED", //{ ID, x, y}
            "ITEM_POINTER_CREATED": "ITEM_POINTER_CREATED", //{ src, dst, ptr}
            "ON_COMPONENT_DELETE": "ON_COMPONENT_DELETE", // ID
            "ON_COMPONENT_CREATE": "ON_COMPONENT_CREATE", // ID
            "ON_COMPONENT_UPDATE": "ON_COMPONENT_UPDATE",  // ID
            "ON_CLEAR": "ON_CLEAR", // ID
            "ITEM_SIZE_CHANGED": "ITEM_SIZE_CHANGED" //{ ID, w, h}
        };
    };

    return SnapEditorWidgetEventDispatcher;
});