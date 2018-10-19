/* jshint -W083 */
import external from '../../externalModules.js';
import EVENTS from '../../events.js';
import { removeToolState, getToolState } from '../../stateManagement/toolState.js';
import anyHandlesOutsideImage from '../../manipulators/anyHandlesOutsideImage.js';
import getHandleNearImagePoint from '../../manipulators/getHandleNearImagePoint.js';
import touchMoveAllHandles from '../../manipulators/touchMoveAllHandles.js';
import touchMoveHandle from './moveHandle/touchMoveHandle.js';

export default function (evt) {
  const eventData = evt.detail;
  const { element } = eventData;
  let data;

  const handleDoneMove = (handle) => {
    data.invalidated = true;
    if (anyHandlesOutsideImage(eventData, data.handles)) {
      // Delete the measurement
      removeToolState(element, this.name, data);
    }

    // Update the handles to keep selected state
    if (handle) {
      handle.moving = false;
      handle.selected = true;
    }

    external.cornerstone.updateImage(element);
    element.addEventListener(EVENTS.TOUCH_DRAG, this._moveCallback);
  };

  const coords = eventData.startPoints.canvas;
  const toolData = getToolState(event.currentTarget, this.name);

  if (!toolData) {
    return;
  }

  // Now check to see if there is a handle we can move
  for (let i = 0; i < toolData.data.length; i++) {
    data = toolData.data[i];
    const handleParams = [element, data.handles, coords, this.configuration.distanceThreshold];
    const handle = getHandleNearImagePoint(...handleParams);

    if (handle) {
      element.removeEventListener(EVENTS.TOUCH_DRAG, this._moveCallback);

      data.active = true;

      unselectAllHandles(data.handles);
      handle.moving = true;
      touchMoveHandle(
        eventData,
        this.name,
        data,
        handle,
        () => handleDoneMove(handle));
      preventPropagation(evt);

      return true;
    }
  }

  const getDoneMovingCallback = (handles) => () => {
    setHandlesMovingState(handles, false);
    handleDoneMove();
  };

  for (let i = 0; i < toolData.data.length; i++) {
    data = toolData.data[i];
    if (this.pointNearTool(element, data, coords)) {
      element.removeEventListener(EVENTS.TOUCH_DRAG, this._moveCallback);
      data.active = true;

      unselectAllHandles(data.handles);
      setHandlesMovingState(data.handles, true);

      const doneMovingCallback = getDoneMovingCallback(data.handles);

      touchMoveAllHandles(
        evt,
        data,
        toolData,
        this.name,
        { deleteIfHandleOutsideImage: true,
          preventHandleOutsideImage: false },
        doneMovingCallback);

      preventPropagation(evt);

      return true;
    }
  }
}

// Clear the selected state for the given handles object
const unselectAllHandles = (handles) => {
  let imageNeedsUpdate = false;

  Object.keys(handles).forEach((handleKey) => {
    if (handleKey === 'textBox') {
      return;
    }
    handles[handleKey].selected = false;
    imageNeedsUpdate = handles[handleKey].active || imageNeedsUpdate;
    handles[handleKey].active = false;
  });

  return imageNeedsUpdate;
};

const setHandlesMovingState = (handles, state) => {
  Object.keys(handles).forEach((handleKey) => {
    if (handleKey === 'textBox') {
      return;
    }
    handles[handleKey].moving = state;
  });
};

const preventPropagation = (evt) => {
  evt.stopImmediatePropagation();
  evt.stopPropagation();
  evt.preventDefault();
};
