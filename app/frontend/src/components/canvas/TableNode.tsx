// app-ui/src/components/canvas/TableNode.tsx
import React, { memo, useState, useCallback, ChangeEvent, KeyboardEvent, FocusEvent, useEffect } from 'react';
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
    onContextMenu?: (event: React.MouseEvent, props: any) => void; // Handle context menu from CanvasViewer
}

// Define unique menu ID
const NODE_CONTEXT_MENU_ID = "tableNodeMenu";

// Default columns as fallback
const DEFAULT_COLUMNS: ColumnDef[] = [
    { key: 'sno', label: 'SNO', width: 'w-[70px]', editable: false, order: 0 },
    { key: 'name', label: 'Name', width: 'w-[180px]', editable: true, order: 1 },
    { key: 'desc', label: 'Desc', width: 'w-[135px]', editable: true, order: 2 },
];

// Responsive width mapping for percentage-based design
const getResponsiveWidth = (width: string, isCompact: boolean = false): string => {
    // Map old width classes to percentage-based widths
    const widthMap: { [key: string]: string } = {
        'w-[70px]': 'w-[10%]',    // First column (SNO) - 10%
        'w-[180px]': 'w-[30%]',   // Second column (Name) - 30%
        'w-[135px]': 'w-[60%]',   // Third column (Description) - 60%
        'w-[120px]': 'w-[60%]',   // Fallback for description column
    };
    
    return widthMap[width] || 'w-[30%]'; // Default to 30% if not found
};

const TableNode: React.FC<NodeProps<TableNodeData & { actions: TableNodeActions }>> = ({ data, id: nodeId, selected }) => {
    const { title, rows, columns = DEFAULT_COLUMNS, actions, isMinimized = false, allRows = rows, isTestCase = false, connectedRowUiids = [] } = data;
    
    // Debug: Log table data on render
    console.log(`Table ${nodeId} render: ${title}, Rows: ${rows.length}, All rows: ${allRows.length}, Minimized: ${isMinimized}, TestCase: ${isTestCase}`);
    
    const sortedColumns = [...columns].sort((a, b) => a.order - b.order);
    const reactFlowInstance = useReactFlow(); // Hook to interact with React Flow

    // --- Responsive State ---
    const [isMobile, setIsMobile] = useState(false);
    const [isCompact, setIsCompact] = useState(false);

    // Check screen size
    useEffect(() => {
        const checkScreenSize = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768); // md breakpoint
            setIsCompact(width < 1024); // lg breakpoint
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

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
            parentUiid,
            isTestCase
        });
        
        // Use the parent's context menu handler if provided
        if (actions.onContextMenu) {
            actions.onContextMenu(event, {
                nodeId,
                type,
                rowIndex,
                colKey,
                uiid,
                parentUiid,
                isTestCase
            });
        } else {
            // Fallback to local context menu
            show({
                event,
                props: {
                    nodeId,
                    type,
                    rowIndex,
                    colKey,
                    uiid,
                    parentUiid,
                    isTestCase
                }
            });
        }
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

    // Calculate responsive container width
    const getContainerWidth = () => {
        if (isMobile) return 'w-80 max-w-[90vw]'; // Mobile: smaller, but responsive
        if (isCompact) return 'w-96 max-w-[85vw]'; // Tablet: medium size
        return 'w-[400px] max-w-[600px]'; // Desktop: larger, but with max constraint
    };

    // --- Rendering ---
    return (
        // Add selection border using 'selected' prop from React Flow
        <div
            className={`
                ${getContainerWidth()}
                border-2 rounded-xl shadow-lg text-xs sm:text-sm bg-white
                ${selected ? 'border-purple-500' : 'border-gray-300'}
                overflow-hidden
                relative
            `}
            onContextMenu={(e) => displayContextMenu(e, 'background')} // Context menu on whole node background
        >
            {/* Node Header */}
            <div className="bg-gray-200 px-3 py-2 sm:px-4 sm:py-3 border-b border-gray-300 font-bold text-center text-sm sm:text-base relative text-gray-900 flex justify-between items-center">
                <div className="flex-1 text-center truncate pr-2">
                    {title}
                </div>
                
                {/* Minimize/Maximize Button */}
                <button 
                    className="touch-target flex-shrink-0 text-gray-700 hover:text-gray-900 focus:outline-none transition-colors p-1"
                    onClick={handleToggleSize}
                    title={isMinimized ? "Show all rows" : "Show fewer rows"}
                >
                    {isMinimized ? (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5 5 5-5" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 14l5-5 5 5" />
                        </svg>
                    )}
                </button>
                
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    id={`${nodeId}-target`} 
                    style={{
                        top: '50%',
                        right: 0,
                        width: 10, // small hit area for connections
                        height: 10,
                        background: 'transparent',
                        border: 'none',
                        opacity: 0, // Completely invisible
                        zIndex: 9999,
                        position: 'absolute',
                      }}
                />
            </div>

            {/* Node Body - Table Container */}
            <div className="text-gray-900">
                {/* Responsive Table Wrapper with horizontal scroll */}
                <div className="overflow-x-auto max-w-full">
                    <div className="min-w-full">
                        {/* Header Row */}
                        <div className="flex bg-gray-100 border-b border-gray-300 text-gray-800">
                            {sortedColumns.map(col => (
                                <div 
                                    key={col.key} 
                                    className={`
                                        ${getResponsiveWidth(col.width, isCompact)}
                                        py-1 px-2 sm:py-2 sm:px-3 font-semibold relative group cursor-pointer
                                        border-r border-gray-300 last:border-r-0
                                        flex-shrink-0
                                    `}
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
                                            className="w-full outline-none border border-blue-400 px-1 py-0 m-0 text-xs sm:text-sm bg-white text-gray-900 rounded"
                                        />
                                    ) : (
                                        <span className="break-words block text-gray-800 leading-relaxed" title={col.label}>
                                            {col.label}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Table Body */}
                        <div className="scrollbar-hide">
                        {rows.map((row, rowIndex) => (
                            <div
                                key={`row-${row.id}-${rowIndex}`}
                                className="flex border-b border-gray-200 last:border-b-0 min-h-[32px] sm:min-h-[36px] relative group hover:bg-gray-50"
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
                                            className={`
                                                ${getResponsiveWidth(col.width, isCompact)}
                                                py-1 px-2 sm:py-2 sm:px-3                                                 border-r border-gray-200 
                                                ${isLastCol ? 'border-r-0' : ''} 
                                                ${col.editable ? 'cursor-text' : ''} 
                                                ${isEditing ? 'p-0' : ''}
                                                flex-shrink-0 flex items-start
                                            `}
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
                                                    className="w-full h-full outline-none border border-blue-400 px-1 py-0 m-0 text-xs sm:text-sm bg-white text-gray-900 rounded"
                                                />
                                            ) : (
                                                <span className="break-words block w-full text-gray-900 leading-relaxed" title={String(cellValue)}>
                                                    {String(cellValue)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Only show handle if this row has connections */}
                                {connectedRowUiids.includes(row.uiid || row.id) && (
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={`row-handle-${row.uiid || row.id}`} // Use row UIID for stable handle ID
                                        style={{ 
                                            top: '50%',
                                            right: 0,
                                            width: 10, // small hit area for connections
                                            height: 10,
                                            background: 'transparent',
                                            border: 'none',
                                            zIndex: 9999,
                                            position: 'absolute',
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
                
                {/* Show count of hidden rows if minimized */}
                {isMinimized && allRows.length > rows.length && (
                    <button
                        onClick={() => actions.onToggleSize(nodeId)}
                                                        className="w-full text-center py-2 sm:py-3 text-gray-500 text-xs sm:text-sm border-t border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        <span className="inline-flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            {allRows.length - rows.length} more rows hidden (click to expand)
                        </span>
                    </button>
                )}
            </div>
            
            {/* Special handle for minimized tables that will serve as connection point for hidden rows */}
            {isMinimized && allRows.length > rows.length && (() => {
                // Check if any hidden rows have connections
                const hiddenRows = allRows.slice(rows.length);
                const hasHiddenConnections = hiddenRows.some(row => 
                    connectedRowUiids.includes(row.uiid || row.id)
                );
                
                return hasHiddenConnections && (
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="minimized-rows-handle"
                        style={{
                            bottom: '0',
                            right: 0,
                            width: 10, // small hit area for connections
                            height: 10,
                            background: 'transparent',
                            border: 'none',
                            zIndex: 9999,
                            position: 'relative',
                          }}
                        title={`Connection point for ${allRows.length - rows.length} hidden rows`}
                    />
                );
            })()}
        </div>
    );
};

// Use memo to prevent unnecessary re-renders
export default memo(TableNode);