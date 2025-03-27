// app-ui/src/components/canvas/TableNode.tsx
import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { TableNodeData } from '@/types/canvas'; // Use alias

// Define columns explicitly here for rendering
const COLUMNS = [
    { key: 'sno', label: 'SNO', width: 'w-12' }, // Added width classes
    { key: 'name', label: 'Name', width: 'flex-grow' }, // Name takes remaining space
    { key: 'desc', label: 'Desc', width: 'w-1/3' }, // Description takes a portion
];


const TableNode: React.FC<NodeProps<TableNodeData>> = ({ data, id: nodeId }) => { // Get nodeId
    const { title, rows } = data;

    return (
        <div className="border border-gray-500 rounded bg-white shadow-lg text-sm" style={{ width: '400px' }}> {/* Increased base width */}
             {/* Node Header */}
            <div className="bg-gray-200 p-2 border-b border-gray-400 font-bold text-center text-base"> {/* Increased font size */}
                {title}
                 {/* --- ADD DEFAULT TARGET HANDLE TO NODE HEADER (LEFT) --- */}
                 {/* This handle represents the connection point *to* the table itself */}
                 <Handle
                    type="target"
                    position={Position.Left}
                    id={`${nodeId}-target`} // Unique ID for the node's main target handle
                    className="!bg-red-500 !w-3 !h-3" // Style differently maybe
                    style={{ top: '50%' }} // Position centrally on the left edge
                 />
                  {/* --- END TARGET HANDLE --- */}
            </div>

             {/* Node Body - Header Row */}
            <div className="flex font-semibold bg-gray-50 border-b border-gray-300 px-2 py-1">
                {COLUMNS.map(col => (
                    <div key={col.key} className={`pr-2 ${col.width}`}>
                        {col.label}
                    </div>
                ))}
                {/* Empty space for handle column */}
                 <div className="w-4"></div> {/* Space for handles */}
            </div>

             {/* Node Body - Data Rows */}
            <div className="px-1">
                {rows.map((row) => (
                    <div key={row.id} className="relative flex border-b border-gray-200 last:border-b-0 min-h-[35px] items-stretch"> {/* Use items-stretch */}
                        {COLUMNS.map(col => (
                            <div key={`${row.id}-${col.key}`} className={`px-1 py-1 break-words ${col.width} border-r last:border-r-0`}> {/* Add borders */}
                                {/* Render data - handle potential null/undefined desc */}
                                {col.key === 'sno' && row.sno}
                                {col.key === 'name' && row.name}
                                {col.key === 'desc' && (row.desc || '')}
                            </div>
                        ))}
                        {/* Source Handle (Right Side) positioned relative to the row div */}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={`row-handle-${row.id}`} // Unique source handle ID per row
                            className="!bg-teal-500 !w-3 !h-3"
                            style={{ top: '50%', right: '-10px' }} // Position centrally on right, slightly outside
                        />
                    </div>
                ))}
            </div>
             {/* Add message if no rows */}
             {rows.length === 0 && (
                 <div className="p-2 text-center text-gray-400 italic">No items</div>
             )}
        </div>
    );
};

export default memo(TableNode);