// app-ui/src/types/canvas.ts
import { Node, Edge } from 'reactflow';

export type CustomNode = Node;
export type CustomEdge = Edge;

// Define the structure for data within each row of our tables
export interface TableRowData {
    id: string; // Unique ID for the row (e.g., 'flow-1', 'hlr-10', 'llr-101')
    sno: number;
    name: string;
    desc?: string | null; // Description is optional
    // We might store the original object ID for reference if needed
    originalId?: number;
    [key: string]: any; // Allow any arbitrary column values
}

// Define column definition interface for table headers
export interface ColumnDef {
    key: string;      // Unique identifier for the column
    label: string;    // Display label for the column header
    width: string;    // CSS width class (e.g., 'w-20', 'w-1/2', etc.)
    editable?: boolean; // Whether the column header can be edited
    order: number;    // Display order of the column
}

// Define data structure expected by our custom TableNode component
export interface TableNodeData {
    title: string;
    rows: TableRowData[];
    columns?: ColumnDef[];
}