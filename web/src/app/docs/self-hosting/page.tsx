import { DocH1, DocH2, DocLead, DocP, DocSection, DocCodeBlock, DocCallout, DocTable } from "@/components/docs";

export default function SelfHostingPage() {
  return (
    <>
      <DocH1>Self-Hosting Guide</DocH1>
      <DocLead>
        LoreKit is MIT licensed. Run it locally with your own API keys — no account needed,
        no credits, no limits.
      </DocLead>

      <DocSection>
        <DocH2>Prerequisites</DocH2>
        <DocTable
          columns={[
            { key: "req", label: "Requirement" },
            { key: "desc", label: "Notes" },
          ]}
          rows={[
            { req: "Python 3.11+", desc: "Backend server and AI pipeline" },
            { req: "Node.js 20+", desc: "Frontend build and Drizzle ORM migrations" },
            { req: "PostgreSQL 15+", desc: "With pgvector extension for embeddings" },
            { req: "OpenAI API key", desc: "Story generation (LLM)" },
            { req: "fal.ai API key", desc: "Image, video, and TTS generation" },
          ]}
        />
      </DocSection>

      <DocSection>
        <DocH2>Quick Start</DocH2>
        <DocCodeBlock language="bash">{`# Clone the repo
git clone https://github.com/anthropics/lorekit
cd lorekit

# Install Python dependencies
pip install -e .

# Install frontend dependencies
cd web && npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (OPENAI_API_KEY, FAL_KEY)`}</DocCodeBlock>
      </DocSection>

      <DocSection>
        <DocH2>Database Setup</DocH2>
        <DocCodeBlock language="bash">{`# Create the PostgreSQL database
createdb lorekit

# Apply schema migrations
cd web
npm run db:deploy`}</DocCodeBlock>
        <DocP>
          This uses Drizzle ORM to create all 14 tables including pgvector indexes.
        </DocP>
      </DocSection>

      <DocSection>
        <DocH2>Running</DocH2>
        <DocCodeBlock language="bash">{`# Terminal 1: Start the backend (port 8001)
python -m lorekit.server

# Terminal 2: Start the frontend (port 3001)
cd web && npm run dev`}</DocCodeBlock>
        <DocP>
          Open{" "}
          <a href="http://localhost:3001" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
            localhost:3001
          </a>{" "}
          to use the web app, or connect Claude via MCP (see{" "}
          <a href="/docs/getting-started" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
            Getting Started
          </a>).
        </DocP>
      </DocSection>

      <DocSection>
        <DocH2>Environment Variables</DocH2>
        <DocTable
          columns={[
            { key: "name", label: "Variable", mono: true, accent: true },
            { key: "desc", label: "Description" },
            { key: "example", label: "Example", mono: true },
          ]}
          rows={[
            { name: "DATABASE_URL", desc: "PostgreSQL connection string", example: "postgresql://localhost:5432/lorekit" },
            { name: "OPENAI_API_KEY", desc: "OpenAI API key for story generation", example: "sk-..." },
            { name: "FAL_KEY", desc: "fal.ai API key for image/video/TTS", example: "fal-..." },
            { name: "LLM_PROVIDER", desc: "LLM provider (openai or anthropic)", example: "openai" },
            { name: "LLM_MODEL", desc: "Model name", example: "gpt-5.4" },
          ]}
        />
      </DocSection>

      <DocSection>
        <DocH2>Database Migrations</DocH2>
        <DocP>
          Schema changes are managed by Drizzle ORM. After updating the schema:
        </DocP>
        <DocCodeBlock language="bash">{`cd web
npm run db:generate   # Generate migration SQL from schema changes
npm run db:migrate    # Apply migrations
npm run db:studio     # Visual database browser (optional)`}</DocCodeBlock>
        <DocCallout type="warning">
          <strong>Never use <code className="font-mono text-amber-300">drizzle-kit push</code></strong> — it
          silently deletes RLS policies. Always use generate + migrate.
        </DocCallout>
      </DocSection>
    </>
  );
}
