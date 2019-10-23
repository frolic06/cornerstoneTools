import external from '../../externalModules.js';
import BaseAnnotationTool from '../base/BaseAnnotationTool.js';

// State
import { getToolState } from '../../stateManagement/toolState.js';
import drawTextBox from '../../drawing/drawTextBox.js';
import drawHandles from '../../drawing/drawHandles.js';
// Drawing
import { getNewContext, draw, drawRect, fillBox } from '../../drawing/index.js';

// Util
import { rectangleRoiCursor } from '../cursors/index.js';
import { getLogger } from '../../util/logger.js';

const logger = getLogger('tools:annotation:KeypointRoiTool');

export default class KeypointRoiTool extends BaseAnnotationTool {
  constructor(props = {}) {
    const defaultProps = {
      name: 'KeypointRoi',
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {},
      svgCursor: rectangleRoiCursor,
    };

    super(props, defaultProps);
  }

  createNewMeasurement(eventData) {
    const goodEventData =
      eventData && eventData.currentPoints && eventData.currentPoints.image;

    if (!goodEventData) {
      logger.error(
        `required eventData not supplied to tool ${this.name}'s createNewMeasurement`
      );

      return;
    }

    return {
      visible: true,
      active: true,
      color: undefined,
      invalidated: true,
      handles: {
        start: {
          x: eventData.currentPoints.image.x,
          y: eventData.currentPoints.image.y,
          highlight: true,
          active: false,
        },
        end: {
          x: eventData.currentPoints.image.x,
          y: eventData.currentPoints.image.y,
          highlight: true,
          active: true,
        },
        initialRotation: eventData.viewport.rotation,
        textBox: {
          active: false,
          hasMoved: false,
          movesIndependently: false,
          drawnIndependently: true,
          allowedOutsideImage: true,
          hasBoundingBox: true,
        },
      },
    };
  }

  updateCachedStats() {
    // Implementing to satisfy BaseAnnotationTool
  }

  pointNearTool(element, data, coords, interactionType) {
    const hasStartAndEndHandles =
      data && data.handles && data.handles.start && data.handles.end;
    const validParameters = hasStartAndEndHandles;

    if (!validParameters) {
      logger.warn(
        `invalid parameters supplied to tool ${this.name}'s pointNearTool`
      );
    }
    if (!validParameters || data.visible === false) {
      return false;
    }
    const distance = interactionType === 'mouse' ? 15 : 25;
    const startCanvas = external.cornerstone.pixelToCanvas(
      element,
      data.handles.start
    );
    const endCanvas = external.cornerstone.pixelToCanvas(
      element,
      data.handles.end
    );
    const rect = {
      left: Math.min(startCanvas.x, endCanvas.x),
      top: Math.min(startCanvas.y, endCanvas.y),
      width: Math.abs(startCanvas.x - endCanvas.x),
      height: Math.abs(startCanvas.y - endCanvas.y),
    };
    const distanceToPoint = external.cornerstoneMath.rect.distanceToPoint(
      rect,
      coords
    );

    const prevHovered = data.hovered;

    data.hovered = distanceToPoint < distance;
    if (prevHovered !== data.hovered) {
      external.cornerstone.updateImage(element);
    }

    return false; // Always false because we don't want moving
  }

  handleSelectedCallback() {
    // Remove the resizing of the roi by the handle
  }

  toolSelectedCallback() {
    // Remove moving
  }

  renderToolData(evt) {
    const toolData = getToolState(evt.currentTarget, this.name);

    if (!toolData) {
      return;
    }

    const eventData = evt.detail;
    const element = eventData.element;
    const context = getNewContext(eventData.canvasContext.canvas);
    const renderingElementStack = getToolState(element, 'stack').data[0];

    for (let i = 0; i < toolData.data.length; i++) {
      const data = toolData.data[i];

      if (data.visible === false) {
        continue;
      }
      // If not on the correct slice, do not draw
      if (
        data.id &&
        data.sliceIdx !== renderingElementStack.currentImageIdIndex
      ) {
        continue;
      }

      draw(context, this.drawKeypointRoi(data, element, eventData));
    }
  }

  drawKeypointRoi(roi, element, eventData) {
    return context => {
      const isNewMeasure = !roi.id;
      // Check which color the rendered tool should be
      const selected = isNewMeasure || roi.selected || roi.hovered;
      const color = selected ? '#ff00e0' : '#FF55E0';

      let options = { color };

      if (isNewMeasure || roi.hovered) {
        options = {
          color,
          lineDash: [4],
        };
      }

      const corner1 = external.cornerstone.pixelToCanvas(
        element,
        roi.handles.start
      );
      const corner2 = external.cornerstone.pixelToCanvas(
        element,
        roi.handles.end
      );
      const fillColor = `${color}26`;
      const boundingBox = {
        top: Math.min(corner1.y, corner2.y),
        left: Math.min(corner1.x, corner2.x),
        width: Math.abs(corner1.x - corner2.x),
        height: Math.abs(corner1.y - corner2.y),
      };

      fillBox(context, boundingBox, fillColor);

      // Draw the rectangle on the canvas
      drawRect(context, element, roi.handles.start, roi.handles.end, options);

      if (isNewMeasure) {
        const { handleRadius, drawHandlesOnHover } = this.configuration;
        const handleOptions = {
          color,
          handleRadius,
          drawHandlesIfActive: drawHandlesOnHover,
        };

        drawHandles(context, eventData, roi.handles, handleOptions);
      }

      const text = isNewMeasure ? [] : [`ROI #${roi.id}`];

      // If the textbox has not been moved by the user, it should be displayed on the right-most
      // Side of the tool.
      if (!roi.handles.textBox.hasMoved) {
        // Find the rightmost side of the ellipse at its vertical center, and place the textbox here
        // Note that this calculates it in image coordinates
        roi.handles.textBox.x = Math.max(
          roi.handles.start.x,
          roi.handles.end.x
        );
        roi.handles.textBox.y = (roi.handles.start.y + roi.handles.end.y) / 2;
      }

      this.drawLinkedTextBox(
        context,
        element,
        roi.handles.textBox,
        text,
        color,
        0,
        true
      );
    };
  }

  drawLinkedTextBox(context, element, textBox, text, color, xOffset, yCenter) {
    const cornerstone = external.cornerstone;
    // Convert the textbox Image coordinates into Canvas coordinates
    const textCoords = cornerstone.pixelToCanvas(element, textBox);

    if (xOffset) {
      textCoords.x += xOffset;
    }

    const options = {
      centering: {
        x: false,
        y: yCenter,
      },
    };

    // Draw the text box
    textBox.boundingBox = drawTextBox(
      context,
      text,
      textCoords.x,
      textCoords.y,
      color,
      options
    );
  }
}
