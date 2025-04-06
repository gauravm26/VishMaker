// app-ui/src/components/canvas/TableNode.tsx
import React, { memo, useState, useCallback, ChangeEvent, KeyboardEvent, FocusEvent } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { TableNodeData, TableRowData, ColumnDef } from '@/types/canvas'; // Add ColumnDef import
import { useContextMenu } from "react-contexify";

// --- Prop Types for Callbacks ---
interface TableNodeActions {
    onCellChange: (nodeId: string, rowIndex: number, columnKey: keyof TableRowData | string, value: string) => void;
    onAddRow: (nodeId: string, afterRowIndex: number) => void;
    onDeleteRow: (nodeId: string, rowIndex: number) => void;
    onAddColumn: (nodeId: string, columnDef: ColumnDef) => void;
    onDeleteColumn: (nodeId: string, columnKey: string) => void;
    onColumnHeaderChange: (nodeId: string, columnKey: string, newValue: string) => void;
    onToggleSize: (nodeId: string) => void; // Add function to toggle table size
}

// Define unique menu ID
const NODE_CONTEXT_MENU_ID = "tableNodeMenu";

// Default columns as fallback
const DEFAULT_COLUMNS: ColumnDef[] = [
    { key: 'sno', label: 'SNO', width: 'w-[70px]', editable: false, order: 0 },
    { key: 'name', label: 'Name', width: 'w-[180px]', editable: true, order: 1 },
    { key: 'desc', label: 'Desc', width: 'w-[135px]', editable: true, order: 2 },
];

const TableNode: React.FC<NodeProps<TableNodeData & { actions: TableNodeActions }>> = ({ data, id: nodeId, selected }) => {
    const { title, rows, columns = DEFAULT_COLUMNS, actions, isMinimized = false, allRows = rows } = data;
    
    // Debug: Log table data on render
    console.log(`Table ${nodeId} render: ${title}, Rows: ${rows.length}, All rows: ${allRows.length}, Minimized: ${isMinimized}`);
    
    const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
    const reactFlowInstance = useReactFlow(); // Hook to interact with React Flow

    // --- State for Editing ---
    const [editingCell, setEditingCell] = useState<{ rowIndex: number; colKey: keyof TableRowData | string } | null>(null);
    const [editingHeader, setEditingHeader] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // --- Context Menu Hook ---
    const { show } = useContextMenu({ id: NODE_CONTEXT_MENU_ID });

    // --- Event Handlers ---
    const handleDoubleClick = (rowIndex: number, colKey: keyof TableRowData | string, currentValue: string | number | null | undefined) => {
        // Only allow editing specific columns
        const column = sortedColumns.find(c => c.key === colKey);
        if (column?.editable) {
            setEditingCell({ rowIndex, colKey });
            setEditValue(String(currentValue ?? '')); // Set initial input value
        }
    };

    // Header double-click handler
    const handleHeaderDoubleClick = (colKey: string, label: string) => {
        const column = sortedColumns.find(c => c.key === colKey);
        if (column?.editable !== false) {
            setEditingHeader(colKey);
            setEditValue(label);
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
        } else if (editingHeader) {
            // Save header edit
            actions.onColumnHeaderChange(nodeId, editingHeader, editValue);
            setEditingHeader(null);
            setEditValue('');
        }
    }, [editingCell, editingHeader, editValue, nodeId, actions]); // Ensure dependencies are correct

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
            setEditingHeader(null);
            setEditValue('');
            e.preventDefault();
        }
    };

    const displayContextMenu = (event: React.MouseEvent, type: 'header' | 'row' | 'background', rowIndex?: number, colKey?: string) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Get UIID information for rows
        let uiid: string | undefined;
        let parentUiid: string | undefined;
        
        if (type === 'row' && rowIndex !== undefined && rows && rows[rowIndex]) {
            // Extract the UIID from the row data
            uiid = rows[rowIndex].uiid || rows[rowIndex].id;
            
            // Try to get parent UIID if available in originalData
            if (rows[rowIndex].originalData) {
                // The parent relationship could be in originalData based on table structure
                const originalData = rows[rowIndex].originalData;
                if (originalData.parent_uiid) {
                    parentUiid = originalData.parent_uiid;
                }
            }
        }
        
        console.log(`TableNode: Displaying ${type} context menu`, { 
            nodeId, 
            rowIndex, 
            colKey,
            uiid,
            parentUiid 
        });
        
        show({
            event,
            props: {
                nodeId,
                type,
                rowIndex,
                colKey,
                uiid,
                parentUiid
            }
        });
    };

    const handleAddColumn = () => {
        const lastOrder = sortedColumns.length > 0 
            ? Math.max(...sortedColumns.map(col => col.order)) 
            : -1;
            
        const newColumn: ColumnDef = {
            key: `col-${Date.now()}`,
            label: 'New Column',
            width: 'w-[120px]',
            editable: true,
            order: lastOrder + 1
        };
        
        actions.onAddColumn(nodeId, newColumn);
    };

    const handleDeleteColumn = (colKey: string) => {
        actions.onDeleteColumn(nodeId, colKey);
    };
    
    // Toggle table size (minimize/maximize)
    const handleToggleSize = () => {
        if (actions.onToggleSize) {
            actions.onToggleSize(nodeId);
        }
    };

    // --- Rendering ---
    return (
        // Add selection border using 'selected' prop from React Flow
        <div
            className={`border-2 rounded shadow-lg text-sm bg-white dark:bg-gray-800 ${selected ? 'border-blue-500 dark:border-blue-400' : 'border-gray-500 dark:border-gray-600'}`}
            style={{ width: '400px' }}
            onContextMenu={(e) => displayContextMenu(e, 'background')} // Context menu on whole node background
        >
            {/* Node Header */}
            <div className="bg-gray-200 dark:bg-gray-700 p-2 border-b border-gray-400 dark:border-gray-600 font-bold text-center text-base relative text-gray-900 dark:text-gray-100 flex justify-between items-center">
                <div className="flex-1 text-center">{title}</div>
                
                {/* Minimize/Maximize Button */}
                <button 
                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none transition-colors"
                    onClick={handleToggleSize}
                    title={isMinimized ? "Show all rows" : "Show fewer rows"}
                >
                    {isMinimized ? (
                        <span className="text-xl">⤢</span> // Maximize icon
                    ) : (
                        <span className="text-xl">⤡</span> // Minimize icon
                    )}
                </button>
                
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    id={`${nodeId}-target`} 
                    className="!bg-red-500 !w-3 !h-3" 
                    style={{ top: '50%', left: '-7px' }} 
                />
            </div>

            {/* Node Body - Table Container with no padding to align borders */}
            <div className="text-gray-900 dark:text-gray-200">
                {/* Header Row */}
                <div className="flex bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100">
                    {sortedColumns.map(col => (
                        <div 
                            key={col.key} 
                            className={`${col.width} py-1 px-2 font-semibold relative group cursor-pointer`}
                            onDoubleClick={() => handleHeaderDoubleClick(col.key, col.label)}
                            onContextMenu={(e) => displayContextMenu(e, 'header', undefined, col.key)}
                        >
                            {editingHeader === col.key ? (
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={handleInputChange}
                                    onBlur={handleInputBlur}
                                    onKeyDown={handleInputKeyDown}
                                    autoFocus
                                    className="w-full outline-none border border-blue-400 dark:border-blue-500 px-1 py-0 m-0 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                />
                            ) : (
                                <>
                                    {col.label}
                                </>
                            )}
                        </div>
                    ))}
                    {/* No extra element for handle space */}
                </div>

                <div>
                    {rows.map((row, rowIndex) => (
                        <div
                            key={`row-${row.id}-${rowIndex}`}
                            className="flex border-b border-gray-200 dark:border-gray-700 last:border-b-0 min-h-[35px] relative group"
                            onContextMenu={(e) => displayContextMenu(e, 'row', rowIndex)}
                            title={`UIID: ${row.uiid || row.id}`}
                            data-row-id={row.id}
                            data-row-index={rowIndex}
                            data-row-sno={row.sno}
                        >
                            {sortedColumns.map((col, colIndex) => {
                                const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colKey === col.key;
                                const cellValue = row[col.key as keyof TableRowData] ?? '';
                                const isLastCol = colIndex === sortedColumns.length - 1;

                                return (
                                    <div
                                        key={`cell-${row.id}-${col.key}-${rowIndex}-${colIndex}`}
                                        className={`${col.width} py-1 px-2 border-r dark:border-gray-600 ${isLastCol ? 'border-r-0 relative' : ''} ${col.editable ? 'cursor-text' : ''} ${isEditing ? 'p-0' : ''}`}
                                        onDoubleClick={() => handleDoubleClick(rowIndex, col.key, cellValue)}
                                    >
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                                onKeyDown={handleInputKeyDown}
                                                autoFocus
                                                className="w-full h-full outline-none border border-blue-400 dark:border-blue-500 px-1 py-0 m-0 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                            />
                                        ) : (
                                            String(cellValue)
                                        )}
                                        
                                        {/* Conditionally render the handle on the last column */}
                                        {isLastCol && (
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                id={`row-handle-${row.uiid || row.id}`} // Use row UIID for stable handle ID
                                                className="!bg-blue-500 !w-3 !h-3"
                                                style={{ top: '50%', right: '-7px' }} // Adjust position as needed
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
                
                {/* Show count of hidden rows if minimized */}
                {isMinimized && allRows.length > rows.length && (
                    <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm border-t border-gray-200 dark:border-gray-700">
                        {allRows.length - rows.length} more rows hidden. Click ⤢ to show all.
                    </div>
                )}
            </div>
            
            {/* Special handle for minimized tables that will serve as connection point for hidden rows */}
            {isMinimized && allRows.length > rows.length && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="minimized-rows-handle"
                    className="!bg-purple-500 !w-4 !h-4"
                    style={{ 
                        right: '-7px',
                        bottom: '+10px'
                    }}
                    title={`Connection point for ${allRows.length - rows.length} hidden rows`}
                />
            )}
        </div>
    );
};

// Use memo to prevent unnecessary re-renders
export default memo(TableNode);