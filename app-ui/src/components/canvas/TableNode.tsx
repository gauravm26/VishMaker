// app-ui/src/components/canvas/TableNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { TableNodeData } from '../../types/canvas'; // Import the data type

// memo avoids unnecessary re-renders
const TableNode: React.FC<NodeProps<TableNodeData>> = ({ data }) => {
    const { title, rows } = data;

    return (
        <div className="border border-gray-400 rounded bg-white shadow-md text-sm">
             {/* Node Header */}
            <div className="bg-gray-100 p-2 border-b border-gray-300 font-semibold text-center">
                {title}
            </div>

             {/* Node Body - Rows */}
            <div className="p-1">
                {rows.map((row) => (
                    <div key={row.id} className="relative border-b border-gray-200 last:border-b-0 px-2 py-1 min-h-[30px] flex items-center">
                        {/* Row Text */}
                        <span className="flex-grow mr-2">{row.text}</span>

                        {/* Source Handle (Right Side) for each row */}
                        {/* The handle ID MUST match the ID used in the edge definition's `sourceHandle` */}
                        {/* We use `row-${row.id}` as the convention */}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`row-${row.id}`} // Unique handle ID per row
                            className="!bg-teal-500 !w-2 !h-2" // Style the handle
                        />
                         {/* Target Handle (Left Side) - Only one needed per node usually */}
                        {/* Place it centrally or omit if only connecting via source handles */}
                         <Handle
                            type="target"
                            position={Position.Left}
                            id="target-handle" // Default or specific ID
                             className="!bg-orange-500 !w-2 !h-2" // Style the handle
                        />
                    </div>
                ))}
                 {/* Add a default target handle if no rows, or if needed */}
                 {rows.length === 0 && (
                     <Handle
                        type="target"
                        position={Position.Left}
                        id="target-handle-empty"
                        className="!bg-orange-500 !w-2 !h-2"
                     />
                 )}
            </div>
        </div>
    );
};

export default memo(TableNode);
