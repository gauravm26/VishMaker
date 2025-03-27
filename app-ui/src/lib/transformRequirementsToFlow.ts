// app-ui/src/lib/transformRequirementsToFlow.ts
// ADD TestCase to import
import { UserFlow, FlowStep, HighLevelRequirement, LowLevelRequirement, TestCase } from '@/types/project';
import { CustomNode, CustomEdge, TableNodeData, TableRowData } from '@/types/canvas';
import { Position } from 'reactflow';

// Layout Constants
const X_FLOW = 50;
const X_HLR = 550;
const X_LLR = 1050;
const X_TESTING = 1550; // <-- ADD Column for Testing
const Y_START = 50;
const Y_SPACING_NODES = 40;
const Y_GROUP_SPACING = 80;
const BASE_ROW_HEIGHT = 38;
const NODE_HEADER_HEIGHT = 40;

// Define FlowElements interface properly to include nodes and edges properties
interface FlowElements {
    nodes: CustomNode[];
    edges: CustomEdge[];
}

function estimateNodeHeight(rows: number): number {
    return NODE_HEADER_HEIGHT + (rows * BASE_ROW_HEIGHT);
}

export function transformRequirementsToFlow(projectRequirements: { project_id: number; flows: UserFlow[] }): FlowElements {
    const nodes: CustomNode[] = [];
    const edges: CustomEdge[] = [];
    let currentFlowTableY = Y_START;

    const hlrRowHandleMap: { [hlrId: number]: string } = {};
    const hlrTableMap: { [hlrId: number]: string } = {};
    // --- ADD LLR Mapping ---
    const llrRowHandleMap: { [llrId: number]: string } = {}; // Maps original LLR ID to its table's ROW handle ID
    const llrTableMap: { [llrId: number]: string } = {}; // Maps original LLR ID to its parent LLR table node ID

    // Ensure required properties exist to prevent "map of undefined" errors
    if (!projectRequirements || !projectRequirements.flows) {
        console.error("Missing required properties in projectRequirements");
        return { nodes, edges };
    }

    // 1. Create Flow Table Node
    const flowNodeId = `flow-table-${projectRequirements.project_id}`;
    const flowRows: TableRowData[] = projectRequirements.flows.map((flow, index) => {
        return {
            id: `flow-${flow.id}`,
            sno: index + 1,
            name: flow.name || `Flow ${index + 1}`,
            desc: flow.description || '',
            originalId: flow.id
        };
    });
    
    const flowNode: CustomNode = {
        id: flowNodeId,
        type: 'tableNode',
        data: {
            title: 'User Flows',
            rows: flowRows
        } as TableNodeData,
        position: { x: X_FLOW, y: currentFlowTableY },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
    };
    nodes.push(flowNode);
    const flowNodeHeight = estimateNodeHeight(flowRows.length);
    let maxY = currentFlowTableY + flowNodeHeight;

    // --- Process HLRs, LLRs, and Test Cases per Flow ---
    let currentHlrColumnY = Y_START;
    projectRequirements.flows.forEach((flow) => {
        // Null checks for flow properties
        if (!flow.steps) {
            console.warn(`Flow ID ${flow.id} has no steps property`);
            return; // Skip this flow
        }

        // 2. Create ONE HLR Table Node PER Flow
        const hlrTableNodeId = `hlr-table-flow-${flow.id}`;
        // Safely extract HLRs by ensuring steps exist and have high_level_requirements
        const allHlrsForFlow: HighLevelRequirement[] = flow.steps
            .filter(step => step && step.high_level_requirements)
            .flatMap(step => step.high_level_requirements || []);
            
        if (allHlrsForFlow.length === 0) {
            console.warn(`Flow ID ${flow.id} has no high level requirements`);
            return; // Skip this flow
        }
        
        const hlrRows: TableRowData[] = allHlrsForFlow.map((hlr, index) => {
            const rowId = `hlr-${hlr.id}`;
            const rowHandleId = `row-handle-${rowId}`;
            hlrRowHandleMap[hlr.id] = rowHandleId;
            hlrTableMap[hlr.id] = hlrTableNodeId;
            return { 
                id: rowId, 
                sno: index + 1, 
                name: hlr.requirement_text || `HLR ${index + 1}`, 
                desc: '', 
                originalId: hlr.id 
            };
        });
        
        const hlrNode: CustomNode = {
            id: hlrTableNodeId,
            type: 'tableNode',
            data: {
                title: `HLRs for Flow: ${flow.id}`,
                rows: hlrRows
            } as TableNodeData,
            position: { x: X_HLR, y: currentHlrColumnY },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        };
        nodes.push(hlrNode);
        const hlrNodeHeight = estimateNodeHeight(hlrRows.length);
        
        // Create Edge: Flow row -> HLR table
        const sourceFlowRowHandleId = `row-handle-flow-${flow.id}`;
        edges.push({
            id: `e-flow${flow.id}-to-hlrTable${flow.id}`,
            source: flowNodeId,
            sourceHandle: sourceFlowRowHandleId,
            target: hlrTableNodeId,
            targetHandle: `${hlrTableNodeId}-target`,
            type: 'smoothstep',
        });

        // --- Process LLRs and Test Cases within this HLR group ---
        let currentLlrColumnY = currentHlrColumnY; // Align LLR tables with HLR table start Y
        allHlrsForFlow.forEach((hlr) => {
            // Ensure low_level_requirements exists
            if (!hlr.low_level_requirements) {
                console.warn(`HLR ID ${hlr.id} has no low_level_requirements property`);
                return; // Skip this HLR
            }
            
            // 3. Create ONE LLR Table Node PER HLR
            const llrTableNodeId = `llr-table-hlr-${hlr.id}`;
            const llrRows: TableRowData[] = hlr.low_level_requirements.map((llr, index) => {
                const rowId = `llr-${llr.id}`;
                const rowHandleId = `row-handle-${rowId}`;
                llrRowHandleMap[llr.id] = rowHandleId;
                llrTableMap[llr.id] = llrTableNodeId;
                return {
                    id: rowId,
                    sno: index + 1,
                    name: llr.requirement_text || `LLR ${index + 1}`,
                    desc: llr.tech_stack_details || '',
                    originalId: llr.id
                };
            });
            
            const llrNode: CustomNode = {
                id: llrTableNodeId,
                type: 'tableNode',
                data: {
                    title: `LLRs for HLR: ${hlr.id}`,
                    rows: llrRows
                } as TableNodeData,
                position: { x: X_LLR, y: currentLlrColumnY },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            };
            nodes.push(llrNode);
            const llrNodeHeight = estimateNodeHeight(llrRows.length);

            // Create Edge: HLR row -> LLR table
            const sourceHlrTableNodeId = hlrTableMap[hlr.id];
            const sourceHlrRowHandleId = hlrRowHandleMap[hlr.id];
            if (sourceHlrTableNodeId && sourceHlrRowHandleId) {
                edges.push({
                    id: `e-hlr${hlr.id}-to-llrTable${hlr.id}`,
                    source: sourceHlrTableNodeId,
                    sourceHandle: sourceHlrRowHandleId,
                    target: llrTableNodeId,
                    targetHandle: `${llrTableNodeId}-target`,
                    type: 'smoothstep',
                });
            }

            // --- 4. Create Test Case Table Nodes (one per LLR) ---
            let currentTestColumnY = currentLlrColumnY; // Align Test Case tables with LLR table start Y
            hlr.low_level_requirements.forEach((llr) => {
                // Add detailed debugging for the LLR and test_cases property
                console.log(`DEBUG LLR [ID: ${llr.id}]:`, llr);
                console.log(`DEBUG test_cases for LLR [ID: ${llr.id}]:`, llr.test_cases);
                
                // Ensure test_cases property exists - create empty array if missing
                if (!llr.test_cases) {
                    console.warn(`LLR ID ${llr.id} has no test_cases property - creating empty array`);
                    llr.test_cases = []; // Initialize with empty array to prevent mapping errors
                }
                
                const testTableNodeId = `test-table-llr-${llr.id}`;
                const testRows: TableRowData[] = llr.test_cases.map((tc: TestCase, index: number) => ({
                    id: `tc-${tc.id}`,
                    sno: index + 1,
                    name: tc.description || `Test ${index + 1}`,
                    desc: tc.expected_result || '',
                    originalId: tc.id
                }));

                // Skip creating test nodes if no test cases exist
                if (testRows.length === 0) {
                    console.log(`No test cases for LLR ID ${llr.id} - skipping test table creation`);
                    return; // Skip to next LLR
                }

                // Position Test Case node
                const testNode: CustomNode = {
                    id: testTableNodeId,
                    type: 'tableNode',
                    data: {
                        title: `Tests for LLR: ${llr.id}`,
                        rows: testRows
                    } as TableNodeData,
                    position: { x: X_TESTING, y: currentTestColumnY },
                    sourcePosition: Position.Right,
                    targetPosition: Position.Left,
                };
                nodes.push(testNode);
                const testNodeHeight = estimateNodeHeight(testRows.length);

                // Create Edge: LLR row -> Test Case table
                const sourceLlrTableNodeId = llrTableMap[llr.id];
                const sourceLlrRowHandleId = llrRowHandleMap[llr.id];

                if (sourceLlrTableNodeId && sourceLlrRowHandleId) {
                    edges.push({
                        id: `e-llr${llr.id}-to-testTable${llr.id}`,
                        source: sourceLlrTableNodeId,
                        sourceHandle: sourceLlrRowHandleId,
                        target: testTableNodeId,
                        targetHandle: `${testTableNodeId}-target`,
                        type: 'smoothstep',
                    });
                } else {
                    console.warn(`Could not find source info for LLR ID ${llr.id} when creating edge to Test table ${testTableNodeId}`);
                }

                // Update Y position for the next Test Case node within this LLR group
                currentTestColumnY += testNodeHeight + Y_SPACING_NODES;
            }); // End Test Case loop for this LLR

            // Update the starting Y for the next LLR table, considering Test Case table heights
            currentLlrColumnY = Math.max(currentLlrColumnY + llrNodeHeight + Y_SPACING_NODES, currentTestColumnY);

        }); // End LLR loop for this HLR

        // Update the starting Y for the next HLR table group
        currentHlrColumnY = Math.max(currentHlrColumnY + hlrNodeHeight + Y_SPACING_NODES, currentLlrColumnY) + Y_GROUP_SPACING;
        maxY = Math.max(maxY, currentHlrColumnY);

    }); // End Flow loop

    return { nodes, edges };
}