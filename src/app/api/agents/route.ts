import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// In-memory store (will connect to Supabase later)
let customAgents: any[] = [];

// Get workspace path dynamically
function getAgentsPath(): string {
  // Go up from projects/colony to workspace root
  return path.join(process.cwd(), '..', 'AGENTS.md');
}

export async function GET() {
  try {
    // Return hardcoded agents from AGENTS.md + custom agents
    const defaultAgents = [
      {
        id: 'main',
        name: 'Rei',
        role: 'Product Manager',
        avatar: '✨',
        personality: 'Professional',
        model: 'MiniMax M2.1',
        status: 'active',
        systemPrompt: 'You are Rei, a Product Manager helping Vincent with project management and coordination.'
      },
      {
        id: 'yilong',
        name: 'Yilong',
        role: 'Senior Engineer',
        avatar: '👨‍🔧',
        personality: 'Direct',
        model: 'MiniMax M2.1',
        status: 'active',
        systemPrompt: 'You are Yilong, a Senior Engineer. You review code, debug issues, and help with technical decisions.'
      },
      {
        id: 'dan',
        name: 'Dan',
        role: 'QA Tester',
        avatar: '🧪',
        personality: 'Thorough',
        model: 'MiniMax M2.1',
        status: 'active',
        systemPrompt: 'You are Dan, a QA Tester. You run tests, find bugs, and verify functionality.'
      }
    ];
    
    return NextResponse.json({ 
      agents: [...defaultAgents, ...customAgents], 
      customAgents 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      agents: [], 
      customAgents: [],
      error: error.message || 'Failed to fetch agents' 
    });
  }
}

export async function POST(request: Request) {
  try {
    const agent = await request.json();
    
    if (!agent.name) {
      return NextResponse.json({ error: 'Agent name required' }, { status: 400 });
    }
    
    // Add to custom agents
    const newAgent = {
      ...agent,
      id: agent.id || Date.now().toString(),
      status: 'active'
    };
    customAgents.push(newAgent);
    
    // Update AGENTS.md to include this agent
    const agentsPath = getAgentsPath();
    
    try {
      if (fs.existsSync(agentsPath)) {
        let content = fs.readFileSync(agentsPath, 'utf-8');
        
        // Check if agent already exists
        if (!content.includes(`@${newAgent.name.toLowerCase()}`)) {
          // Find the line with @dan (last agent) and add after it
          const danLine = content.indexOf('@dan');
          if (danLine !== -1) {
            // Find the end of that line
            const lineEnd = content.indexOf('\n', danLine);
            const agentLine = `\n| **@${newAgent.name.toLowerCase()}** | ${newAgent.role} | ~/workspace/colony-agents | ${newAgent.model} |`;
            content = content.slice(0, lineEnd) + agentLine + content.slice(lineEnd);
            fs.writeFileSync(agentsPath, content, 'utf-8');
          }
        }
      }
    } catch (e) {
      console.error('Failed to update AGENTS.md:', e);
    }
    
    return NextResponse.json({ success: true, agent: newAgent });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
