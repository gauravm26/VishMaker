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
}

// Define data structure expected by our custom TableNode component
export interface TableNodeData {
    title: string;
    rows: TableRowData[];
    // Define columns explicitly for clarity, though TableNode might hardcode them
    columns?: Array<{ key: keyof TableRowData | string; label: string }>;
}