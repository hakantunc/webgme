/*globals define, _, requirejs, WebGMEGlobal*/


define(['./DragEffects',
        './DragConstants'], function (DragEffects, DragConstants) {

    "use strict";

    var DEFAULT_Z_INDEX = 100000,
        DEFAULT_APPEND_TO = $('body'),
        DEFAULT_CURSOR_AT = { left: 10, top: 10 };


    var _makeDraggable = function (el, params) {
        el.draggable({
            zIndex: DEFAULT_Z_INDEX,
            appendTo: DEFAULT_APPEND_TO,
            cursorAt: DEFAULT_CURSOR_AT,
            helper: function (event) {
                var helperEl,
                    dragInfo = _createDragInfo(el, params, event);

                if (params && _.isFunction(params.helper)) {
                    helperEl = params.helper.call(el, event, dragInfo);
                } else {
                    helperEl = el.clone();
                }

                //prevent dragged helper to catch any pointer events
                helperEl.css({'pointer-events':'none'});

                //add DRAG info
                helperEl.data(DragConstants.DRAG_INFO, dragInfo);

                return helperEl;
            },
            start: function( event, ui ) {
                if (params && _.isFunction(params.start)) {
                    return params.start.call(el, event);
                }
            },
            drag: function( event, ui ) {
                if (params && _.isFunction(params.drag)) {
                    return params.drag.call(el, event);
                }
            },
            stop: function( event, ui ) {
                if (params && _.isFunction(params.stop)) {
                    return params.stop.call(el, event);
                }
            }
        });
    };


    var _destroyDraggable = function (el) {
        if (_isDraggable(el)) {
            el.draggable("destroy");
        }
    };

    var _enableDraggable = function (el, enabled) {
        var enabledStr = enabled ? 'enable' : 'disable';

        if (_isDraggable(el)) {
            el.draggable(enabledStr);
        }
    };

    var _isDraggable = function (el) {
        return el.hasClass('ui-draggable');
    };

    var _createDragInfo = function (el, params, event) {
        var dragInfo = {};

        dragInfo[DragConstants.DRAG_ITEMS] = [];
        if (params && _.isFunction(params.dragItems)) {
            dragInfo[DragConstants.DRAG_ITEMS] = params.dragItems(el) || [];
        }

        dragInfo[DragConstants.DRAG_EFFECTS] = [];
        if (params && _.isFunction(params.dragEffects)) {
            dragInfo[DragConstants.DRAG_EFFECTS] = params.dragEffects(el, event) || [];
        }

        dragInfo[DragConstants.DRAG_PARAMS] = undefined;
        if (params && _.isFunction(params.dragParams)) {
            dragInfo[DragConstants.DRAG_PARAMS] = params.dragParams(el, event);
        }

        return dragInfo;
    };

    return {
        DRAG_EFFECTS: DragEffects,
        DEFAULT_CURSOR_AT: {'left': DEFAULT_CURSOR_AT.left,
                            'top': DEFAULT_CURSOR_AT.top},
        makeDraggable: _makeDraggable,
        destroyDraggable: _destroyDraggable,
        enableDraggable: _enableDraggable
    };
});