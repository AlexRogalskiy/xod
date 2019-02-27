import * as R from 'ramda';
import React from 'react';
import PropTypes from 'prop-types';
import Markdown from 'react-remarkable';
import classNames from 'classnames';

import { noop } from '../../utils/ramda';

import { NODE_CORNER_RADIUS, RESIZE_HANDLE_SIZE } from '../nodeLayout';

// see https://github.com/jonschlinkert/remarkable#options
const remarkableOptions = {
  breaks: true,
  linkify: true,
};

class Comment extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isEditing: false,
      editorValue: '',
    };

    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onResizeHandleMouseDown = this.onResizeHandleMouseDown.bind(this);
    this.onEditorChange = this.onEditorChange.bind(this);
    this.onEditorKeyDown = this.onEditorKeyDown.bind(this);

    this.beginEditing = this.beginEditing.bind(this);
    this.finishEditing = this.finishEditing.bind(this);
    this.cancelEditing = this.cancelEditing.bind(this);
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      !R.eqBy(
        R.omit([
          'onMouseDown',
          'onMouseUp',
          'onResizeHandleMouseDown',
          'onFinishEditing',
        ]),
        nextProps,
        this.props
      ) || !R.equals(nextState, this.state)
    );
  }

  onMouseDown(event) {
    if (!this.state.isEditing) {
      this.props.onMouseDown(event, this.props.id);
    }
  }

  onMouseUp(event) {
    if (!this.state.isEditing) {
      this.props.onMouseUp(event, this.props.id);
    }
  }

  onResizeHandleMouseDown(event) {
    event.stopPropagation();
    this.props.onResizeHandleMouseDown(event, this.props.id);
  }

  onEditorChange(event) {
    this.setState({ editorValue: event.target.value });
  }

  onEditorKeyDown(event) {
    const { key, metaKey, ctrlKey } = event;

    if (key === 'Enter' && (metaKey || ctrlKey)) {
      this.finishEditing();
    }

    if (key === 'Escape') {
      this.cancelEditing();
    }
  }

  beginEditing() {
    if (!this.state.isEditing) {
      this.setState({
        isEditing: true,
        editorValue: this.props.content,
      });
    }
  }

  finishEditing() {
    this.props.onFinishEditing(this.props.id, this.state.editorValue);
    this.setState({
      isEditing: false,
    });
  }

  cancelEditing() {
    this.setState({
      isEditing: false,
    });
  }

  render() {
    const {
      id,
      content,
      pxPosition,
      pxSize,
      isSelected,
      isDragged,
      hidden,
    } = this.props;

    const { isEditing, editorValue } = this.state;

    const cls = classNames('Comment', {
      'is-selected': isSelected,
      'is-dragged': isDragged,
      'is-editing': isEditing,
      'is-hidden': hidden,
    });

    const maskId = `comment-mask-${id}${isDragged ? '-dragged' : ''}`;

    const bodyRectProps = {
      rx: NODE_CORNER_RADIUS,
      ry: NODE_CORNER_RADIUS,
    };

    return (
      <g
        className={cls}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onDoubleClick={this.beginEditing}
      >
        <clipPath id={maskId}>
          <rect
            className="mask"
            {...pxPosition}
            {...pxSize}
            {...bodyRectProps}
          />
        </clipPath>
        <rect
          {...pxPosition}
          {...pxSize}
          className="body"
          clipPath={`url(#${maskId})`}
        />
        <path
          clipPath={`url(#${maskId})`}
          className="CommentResizeHandle"
          d={`
              M${pxPosition.x + pxSize.width} ${pxPosition.y + pxSize.height}
              v ${-RESIZE_HANDLE_SIZE}
              l ${-RESIZE_HANDLE_SIZE} ${RESIZE_HANDLE_SIZE}
              Z
            `}
        />
        <rect
          className="outline"
          {...pxPosition}
          {...pxSize}
          {...bodyRectProps}
        />
        <foreignObject {...pxSize} {...pxPosition}>
          <div className="container" xmlns="http://www.w3.org/1999/xhtml">
            {isEditing ? (
              <textarea
                className="content editor"
                onChange={this.onEditorChange}
                onKeyDown={this.onEditorKeyDown}
                onBlur={this.finishEditing}
                value={editorValue}
                autoFocus
              />
            ) : (
              <div className="content viewer">
                <Markdown options={remarkableOptions} source={content} />
              </div>
            )}
          </div>
        </foreignObject>
        <rect
          className="resizeHandleOverlay"
          onMouseDown={this.onResizeHandleMouseDown}
          x={pxPosition.x + pxSize.width - RESIZE_HANDLE_SIZE}
          y={pxPosition.y + pxSize.height - RESIZE_HANDLE_SIZE}
          width={RESIZE_HANDLE_SIZE}
          height={RESIZE_HANDLE_SIZE}
        />
      </g>
    );
  }
}

Comment.propTypes = {
  id: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  pxSize: PropTypes.any.isRequired,
  pxPosition: PropTypes.object.isRequired,
  isSelected: PropTypes.bool,
  isDragged: PropTypes.bool,
  hidden: PropTypes.bool,
  onMouseDown: PropTypes.func,
  onMouseUp: PropTypes.func,
  onResizeHandleMouseDown: PropTypes.func,
  onFinishEditing: PropTypes.func,
};

Comment.defaultProps = {
  isSelected: false,
  isGhost: false,
  isDragged: false,
  onMouseDown: noop,
  onMouseUp: noop,
  onResizeHandleMouseDown: noop,
  onFinishEditing: noop,
};

export default Comment;
