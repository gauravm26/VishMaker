// app-ui/src/components/canvas/TableNode.tsx
import React, { memo, useState, useCallback, ChangeEvent, KeyboardEvent, FocusEvent } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { TableNodeData, TableRowData } from '@/types/canvas'; // Use alias
import { useContextMenu } from "react-contexify";

// --- Prop Types for Callbacks ---
interface TableNodeActions {
    onCellChange: (nodeId: string, rowIndex: number, columnKey: keyof TableRowData | string, value: string) => void;
    onAddRow: (nodeId: string, afterRowIndex: number) => void;
    onDeleteRow: (nodeId: string, rowIndex: number) => void;
    // Add handlers for columns/resizing later
}

// Define unique menu ID
const NODE_CONTEXT_MENU_ID = "tableNodeMenu";

// Define columns explicitly here for rendering (same as before)
const COLUMNS = [
    { key: 'sno', label: 'SNO', width: 'w-12', editable: false }, // SNO likely not editable
    { key: 'name', label: 'Name', width: 'flex-grow', editable: true },
    { key: 'desc', label: 'Desc', width: 'w-1/3', editable: true },
];


const TableNode: React.FC<NodeProps<TableNodeData & { actions: TableNodeActions }>> = ({ data, id: nodeId, selected }) => {
    const { title, rows, actions } = data;
    const reactFlowInstance = useReactFlow(); // Hook to interact with React Flow

    // --- State for Editing ---
    const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: keyof TableRowData | string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // --- Context Menu Hook ---
    const { show } = useContextMenu({ id: NODE_CONTEXT_MENU_ID });

    // --- Event Handlers ---
    const handleDoubleClick = (rowIndex: number, colKey: keyof TableRowData | string, currentValue: string | number | null | undefined) => {
        // Only allow editing specific columns
        const column = COLUMNS.find(c => c.key === colKey);
        if (column?.editable) {
            setEditingCell({ rowIndex, colKey });
            setEditValue(String(currentValue ?? '')); // Set initial input value
        }
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setEditValue(e.target.value);
    };

    const saveEdit = useCallback(() => {
        if (editingCell) {
            // Call the action prop passed from CanvasViewer to update central state
            actions.onCellChange(nodeId, editingCell.rowIndex, editingCell.colKey, editValue);
            setEditingCell(null); // Exit edit mode
            setEditValue('');
        }
    }, [editingCell, editValue, nodeId, actions]); // Ensure dependencies are correct

    const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
        // Check if the blur was caused by clicking outside the input into non-interactive node space
        // This is tricky - might need more robust focus management
        saveEdit();
    };

    const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            saveEdit();
            e.preventDefault(); // Prevent form submission if wrapped in form
        } else if (e.key === 'Escape') {
            setEditingCell(null); // Cancel edit
            setEditValue('');
            e.preventDefault();
        }
    };

    const displayContextMenu = (event: React.MouseEvent, rowIndex?: number) => {
        event.preventDefault();
        event.stopPropagation();
        // --- ADD THIS LOG ---
        console.log(`TableNode: Calling show for menu "${NODE_CONTEXT_MENU_ID}" with props:`, { nodeId, rowIndex });
        // --- END LOG ---
        show({ // from useContextMenu({ id: NODE_CONTEXT_MENU_ID });
            event,
            props: { // This object is passed to the Item's onClick handler
                nodeId, // The ID of the node being clicked
                rowIndex, // The index of the row being clicked (or undefined if background)
            }
        });
    };


    // --- Rendering ---
    return (
        // Add selection border using 'selected' prop from React Flow
        <div
            className={`border-2 rounded shadow-lg text-sm bg-white dark:bg-gray-800 ${selected ? 'border-blue-500 dark:border-blue-400' : 'border-gray-500 dark:border-gray-600'}`}
            style={{ width: '400px' }}
            onContextMenu={(e) => displayContextMenu(e)} // Context menu on whole node background
        >
            {/* Node Header */}
            <div className="bg-gray-200 dark:bg-gray-700 p-2 border-b border-gray-400 dark:border-gray-600 font-bold text-center text-base relative text-gray-900 dark:text-gray-100">  {/* Added relative for handle positioning */}
                {title}
                <Handle type="target" position={Position.Left} id={`${nodeId}-target`} className="!bg-red-500 !w-3 !h-3" style={{ top: '50%', left: '-6px' }} />
            </div>

            {/* Node Body - Header Row */}
            <div className="flex font-semibold bg-gray-100 dark:bg-gray-750 border-b border-gray-300 dark:border-gray-600 px-2 py-1 text-gray-800 dark:text-gray-200"> {/* Header row bg, border, text */}
                {COLUMNS.map(col => ( <div key={col.key} className={`pr-2 ${col.width}`}>{col.label}</div> ))}
                <div className="w-4"></div> {/* Space for handles */}
            </div>

            {/* Node Body - Data Rows */}
            <div className="px-1 text-gray-900 dark:text-gray-200">
                {rows.map((row, rowIndex) => (
                    <div
                        key={row.id}
                        className="relative flex border-b border-gray-200 dark:border-gray-700 last:border-b-0 min-h-[35px] items-stretch group"// Added group for potential hover effects
                        onContextMenu={(e) => displayContextMenu(e, rowIndex)} // Context menu on row
                    >
                        {COLUMNS.map(col => {
                            const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === col.key;
                            const cellValue = row[col.key as keyof TableRowData] ?? '';

                            return (
                                <div
                                    key={`${row.id}-${col.key}`}
                                    className={`px-1 py-1 break-words ${col.width} border-r dark:border-gray-600 last:border-r-0 ${col.editable ? 'cursor-text' : ''} ${isEditing ? 'p-0' : ''}`}// Remove padding when editing
                                    onDoubleClick={() => col.editable ? handleDoubleClick(rowIndex, col.key, cellValue) : undefined}
                                >
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={handleInputChange}
                                            onBlur={handleInputBlur}
                                            onKeyDown={handleInputKeyDown}
                                            autoFocus // Focus the input when it appears
                                            className="w-full h-full outline-none border border-blue-400 dark:border-blue-500 px-1 py-0 m-0 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" // Style input to fill cell
                                        />
                                    ) : (
                                        // Render data - handle potential null/undefined desc, convert numbers
                                        String(cellValue)
                                    )}
                                </div>
                            );
                        })}
                        {/* Source Handle per row */}
                        <Handle type="source" position={Position.Right} id={`row-handle-${row.id}`} className="!bg-teal-500 !w-3 !h-3 dark:bg-teal-400" style={{ top: '50%', right: '-10px' }} />
                    </div>
                ))}
            </div>
            {rows.length === 0 && ( <div className="p-2 text-center text-gray-400 dark:text-gray-500 italic">No items</div> )}

             {/* --- Context Menu Component --- */}

             {/* --- End Context Menu --- */}
        </div>
    );
};

export default memo(TableNode);