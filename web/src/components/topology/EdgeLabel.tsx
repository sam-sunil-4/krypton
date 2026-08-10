import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';

export default function EdgeLabel({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: 'var(--bg-secondary)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-light)',
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {data?.label as string || ''}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
