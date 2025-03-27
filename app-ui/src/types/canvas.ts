// app-ui/src/types/canvas.ts
import { Node, Edge } from 'reactflow';

// You can extend the Node/Edge types if you need custom data associated with them
export type CustomNode = Node; // Add custom data properties later if needed
export type CustomEdge = Edge; // Add custom data properties later if needed

// Define data structure expected by our custom nodes
export interface TableNodeData {
    title: string;
    rows: Array<{ id: string; text: string; [key: string]: any }>; // Each row must have id and text
    // Add other properties needed for styling or behavior
}
