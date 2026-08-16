import React, { useState, useEffect, useRef, useMemo, useCallback, useContext, createContext } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  LayoutDashboard, Zap, Package, Share2, ListChecks, MessageSquare,
  UploadCloud, FileSearch, Layers, FileText, ShieldCheck, Database,
  Cpu, Gauge, Sparkles, Search, Bell, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, AlertTriangle, Tag, Boxes, GitBranch,
  Send, X, ExternalLink, Info, ArrowRight, RefreshCw, Check,
  Pencil, Flag, Clock, TrendingUp, FileStack, Settings, Wrench,
  Link2, BadgeCheck, CircleDot, Command, ZoomIn, ZoomOut, Maximize2,
  Sun, Moon, ChevronsUpDown, User, LogOut, HelpCircle, Plus,
  ArrowUpRight, Activity, Eye, Lightbulb, CornerDownLeft, Loader2,
  Mail, Lock, EyeOff, UserPlus, LogIn, Download,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { authApi, tokenStore, ApiError, uploadApi, pipelineApi, productsApi, exportApi, validationApi, analyticsApi, knowledgeGraphApi, searchApi, notificationsApi, auditApi, copilotApi } from "./api/client.js";

/* ------------------------------------------------------------------ */
/*  Theme system (dark / light)                                        */
/* ------------------------------------------------------------------ */
/*
 * This preview environment only supports pre-defined Tailwind utility
 * classes (no JIT/arbitrary values, no editable tailwind.config), so a
 * `dark:` variant strategy isn't reliable here. Instead: the whole app is
 * built dark-first with plain zinc-* classes as before, and when the user
 * switches to light mode we add a `theme-light` class to the root element
 * and a scoped <style> block (ThemeStyleOverrides, rendered once in App)
 * remaps every zinc-* utility class actually used in this file to a light
 * equivalent. Components that draw color via inline style/SVG attributes
 * (charts, the knowledge graph, the confidence ring) read the theme from
 * ThemeContext directly since CSS class overrides can't reach those.
 */
const ThemeContext = createContext("dark");
const useTheme = () => useContext(ThemeContext);

/** Identity of the signed-in user, set once auth succeeds. Avoids prop-
 * drilling name/email through TopBar -> ProfileMenu, Copilot, Settings. */
const UserContext = createContext({ name: "", email: "", company: "", role: "", joinedAt: null, via: null });
const useUser = () => useContext(UserContext);

function deriveNameFromEmail(email) {
  const local = email.split("@")[0] || "";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ") || "User";
}

/** Scoped override stylesheet — only takes effect inside .theme-light. */
function ThemeStyleOverrides() {
  return (
    <style>{`
      .theme-light .bg-zinc-950 { background-color: #fafafa !important; }
      .theme-light .bg-zinc-950\\/80 { background-color: rgba(250,250,250,0.85) !important; }
      .theme-light .bg-zinc-950\\/90 { background-color: rgba(250,250,250,0.92) !important; }
      .theme-light .bg-zinc-900 { background-color: #ffffff !important; }
      .theme-light .bg-zinc-900\\/40 { background-color: rgba(0,0,0,0.03) !important; }
      .theme-light .bg-zinc-900\\/50 { background-color: rgba(0,0,0,0.04) !important; }
      .theme-light .bg-zinc-800 { background-color: #f4f4f5 !important; }
      .theme-light .bg-zinc-800\\/60 { background-color: rgba(0,0,0,0.05) !important; }
      .theme-light .bg-zinc-800\\/80 { background-color: rgba(0,0,0,0.06) !important; }
      .theme-light .bg-zinc-700 { background-color: #e4e4e7 !important; }
      .theme-light .bg-zinc-500 { background-color: #a1a1aa !important; }

      .theme-light .from-zinc-900\\/70 { --tw-gradient-from: #ffffff !important; --tw-gradient-to: rgb(255 255 255 / 0) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
      .theme-light .to-zinc-900\\/40 { --tw-gradient-to: #f4f4f5 !important; }
      .theme-light .from-zinc-700 { --tw-gradient-from: #e4e4e7 !important; --tw-gradient-to: rgb(228 228 231 / 0) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
      .theme-light .to-zinc-800 { --tw-gradient-to: #d4d4d8 !important; }

      .theme-light .text-zinc-50 { color: #18181b !important; }
      .theme-light .text-zinc-100 { color: #18181b !important; }
      .theme-light .text-zinc-200 { color: #27272a !important; }
      .theme-light .text-zinc-300 { color: #3f3f46 !important; }
      .theme-light .text-zinc-400 { color: #52525b !important; }
      .theme-light .text-zinc-500 { color: #71717a !important; }
      .theme-light .text-zinc-600 { color: #a1a1aa !important; }
      .theme-light .text-zinc-700 { color: #d4d4d8 !important; }

      .theme-light .border-zinc-700 { border-color: #d4d4d8 !important; }
      .theme-light .border-zinc-800 { border-color: #e4e4e7 !important; }
      .theme-light .border-zinc-800\\/80 { border-color: rgba(0,0,0,0.08) !important; }
      .theme-light .border-zinc-900 { border-color: #f0f0f1 !important; }
      .theme-light .ring-zinc-700 { --tw-ring-color: #d4d4d8 !important; }

      .theme-light .fill-zinc-300 { fill: #3f3f46 !important; }
      .theme-light .fill-zinc-600 { fill: #a1a1aa !important; }

      .theme-light .shadow-2xl { box-shadow: 0 20px 40px -12px rgba(0,0,0,0.12) !important; }
      .theme-light kbd { color: #71717a !important; }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/*  Design tokens / static maps                                        */
/* ------------------------------------------------------------------ */

const AGENTS = [
  { id: "extraction", name: "Extraction Agent", icon: FileText, desc: "Pulls raw values from documents via OCR, layout parsing and table extraction." },
  { id: "validation", name: "Validation Agent", icon: ShieldCheck, desc: "Cross-checks extracted values against source documents and business rules." },
  { id: "reasoning", name: "Reasoning Agent", icon: Cpu, desc: "Resolves conflicts and infers missing values using retrieved context." },
  { id: "knowledge_graph", name: "Knowledge Graph Agent", icon: Share2, desc: "Links products, components, standards and documents into the graph." },
  { id: "seo", name: "SEO Agent", icon: Tag, desc: "Generates search-optimized titles, metadata and keywords." },
  { id: "recommendation", name: "Recommendation Agent", icon: Boxes, desc: "Identifies compatible products and replacement parts." },
  { id: "compliance", name: "Compliance Agent", icon: BadgeCheck, desc: "Confirms certifications and regulatory claims against evidence." },
];

const AGENT_STYLES = {
  extraction: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-400", solid: "#60a5fa" },
  validation: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", dot: "bg-violet-400", solid: "#a78bfa" },
  reasoning: { text: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30", dot: "bg-indigo-400", solid: "#818cf8" },
  knowledge_graph: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400", solid: "#22d3ee" },
  seo: { text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/30", dot: "bg-pink-400", solid: "#f472b6" },
  recommendation: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400", solid: "#fb923c" },
  compliance: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-400", solid: "#fb7185" },
};

function agentMeta(id) {
  return AGENTS.find((a) => a.id === id) || AGENTS[0];
}

function confidenceStyle(conf) {
  if (conf >= 90) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", bar: "bg-emerald-400", solid: "#34d399", label: "High" };
  if (conf >= 70) return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", bar: "bg-amber-400", solid: "#fbbf24", label: "Medium" };
  return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", bar: "bg-rose-400", solid: "#fb7185", label: "Low" };
}

/**
 * Mirrors Backend/app/models/processing_job.py::PipelineStage exactly (id
 * = enum value), so job.current_stage from the API maps straight onto
 * this list with no translation layer. Order matches STAGE_WEIGHTS in
 * Backend/app/workers/tasks.py.
 */
const PIPELINE_STAGES = [
  { id: "ocr", label: "OCR / Parsing", icon: FileSearch, agent: null, detail: "PaddleOCR + Qwen2.5-VL text extraction" },
  { id: "document_parsing", label: "Document Parsing", icon: Layers, agent: null, detail: "PyMuPDF / Unstructured / Camelot" },
  { id: "information_extraction", label: "Extraction", icon: FileText, agent: "extraction", detail: "Structured fields drafted per source" },
  { id: "knowledge_graph", label: "Knowledge Graph", icon: Share2, agent: "knowledge_graph", detail: "Entities linked in Neo4j" },
  { id: "validation", label: "Validation", icon: ShieldCheck, agent: "validation", detail: "Cross-source consistency + conflict detection" },
  { id: "rag_search", label: "RAG Retrieval", icon: Database, agent: null, detail: "BGE-M3 + Qdrant context lookup" },
  { id: "llm_generation", label: "Multi-Agent Reasoning", icon: Cpu, agent: "reasoning", detail: "LLM conflict resolution + generation" },
  { id: "confidence_scoring", label: "Confidence Scoring", icon: Gauge, agent: null, detail: "Per-field confidence computed" },
  { id: "human_review", label: "Human Review", icon: Eye, agent: null, detail: "Flagged fields queued for reviewer" },
  { id: "completed", label: "Product Intelligence", icon: Sparkles, agent: null, detail: "Catalog record published" },
];

/* Mock multi-source scenario used by the Live Pipeline demo, matching the
 * "Industrial Motor A / IM500" example: three sources agree on most fields,
 * but disagree on Weight — this drives the conflict-resolution UI. */
const IM500_SOURCES = [
  { id: "pdf", label: "motor-datasheet.pdf", icon: FileText, kind: "Datasheet" },
  { id: "excel", label: "products.xlsx", icon: FileStack, kind: "Spec sheet" },
  { id: "website", label: "manufacturer.com/products/im500", icon: Link2, kind: "Manufacturer site" },
];

const IM500_FIELDS = [
  { label: "Power", value: "5 HP", confidence: 96, sources: ["pdf", "excel"] },
  { label: "Voltage", value: "440 V", confidence: 94, sources: ["pdf", "website", "excel"] },
  { label: "Phase", value: "3 Phase", confidence: 98, sources: ["pdf", "excel", "website"] },
];

const IM500_CONFLICT = {
  label: "Weight",
  options: [
    { value: "45 kg", sourceIds: ["pdf", "excel"] },
    { value: "48 kg", sourceIds: ["website"] },
  ],
  confidence: 72,
};

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

const field = (label, value, confidence, agent, evidence, sourceDoc, page) => ({
  id: `${label}-${Math.random().toString(36).slice(2, 8)}`,
  label, value, confidence, agent, evidence, sourceDoc, page,
});

const PRODUCTS = [
  {
    id: "hc-450",
    name: "TerraDyne HC-450 Hydraulic Cylinder",
    category: "Hydraulic Cylinders",
    overallConfidence: 88,
    fieldsNeedingReview: 3,
    lastUpdated: "2 hours ago",
    docs: ["HC-450_Datasheet_RevC.pdf", "Seal_Kit_Spec_Addendum.pdf", "ISO6020_Compliance_Letter.pdf"],
    dna: {
      technicalSpecs: [
        field("Bore Diameter", "80 mm", 97, "extraction", "Bore Ø 80 mm listed in dimensional table", "HC-450_Datasheet_RevC.pdf", 2),
        field("Stroke Length", "250 mm", 95, "extraction", "Stroke: 250 mm, row 4 of specification table", "HC-450_Datasheet_RevC.pdf", 2),
        field("Rod Diameter", "45 mm", 92, "extraction", "Piston rod Ø 45 mm h9 tolerance", "HC-450_Datasheet_RevC.pdf", 2),
        field("Max Operating Pressure", "350 bar", 68, "reasoning", "Datasheet states 320 bar; seal kit addendum rates assembly to 350 bar — value inferred from the higher-rated component, not a direct source match", "Seal_Kit_Spec_Addendum.pdf", 1),
        field("Mounting Type", "Trunnion Mount", 74, "validation", "Cover page diagram shows trunnion mount; parts list on page 5 labels it 'clevis mount' — conflicting sources", "HC-450_Datasheet_RevC.pdf", 5),
        field("Operating Temperature", "-20°C to 80°C", 88, "extraction", "Operating range specified in environmental conditions section", "HC-450_Datasheet_RevC.pdf", 3),
        field("Weight", "18.4 kg", 99, "extraction", "Net weight (unpacked): 18.4 kg", "HC-450_Datasheet_RevC.pdf", 1),
      ],
      marketing: [
        field("Marketing Description", "The HC-450 is a heavy-duty double-acting hydraulic cylinder engineered for demanding mobile and industrial applications, delivering consistent force transfer under high-pressure cycling.", 81, "reasoning", "Synthesized from technical specs, applications list, and datasheet introduction paragraph", "HC-450_Datasheet_RevC.pdf", 1),
      ],
      seo: [
        field("SEO Title", "TerraDyne HC-450 Hydraulic Cylinder – 80mm Bore, 350 Bar", 90, "seo", "Generated from bore, pressure rating and product family", "HC-450_Datasheet_RevC.pdf", 1),
        field("Meta Description", "Shop the TerraDyne HC-450 double-acting hydraulic cylinder: 80mm bore, 250mm stroke, trunnion mount, rated to 350 bar.", 87, "seo", "Derived from confirmed technical specification fields", "HC-450_Datasheet_RevC.pdf", 1),
        field("Keywords", "hydraulic cylinder, double-acting cylinder, trunnion mount, mobile hydraulics", 84, "seo", "Extracted from applications and industry classification", "HC-450_Datasheet_RevC.pdf", 1),
      ],
      applications: [
        field("Application", "Mobile hydraulics", 91, "reasoning", "Listed under 'Typical Applications'", "HC-450_Datasheet_RevC.pdf", 3),
        field("Application", "Agricultural equipment", 85, "reasoning", "Inferred from mounting type and pressure class typical of ag machinery", "HC-450_Datasheet_RevC.pdf", 3),
        field("Application", "Material handling equipment", 79, "reasoning", "Inferred from bore size and stroke range against industry norms", "HC-450_Datasheet_RevC.pdf", 3),
      ],
      certifications: [
        field("ISO 6020/2", "Certified", 96, "compliance", "Compliance letter references ISO 6020/2 test report number", "ISO6020_Compliance_Letter.pdf", 1),
        field("CE Marking", "Certified", 93, "compliance", "CE declaration of conformity attached to datasheet appendix", "HC-450_Datasheet_RevC.pdf", 6),
        field("RoHS Compliance", "Likely Compliant", 62, "compliance", "No explicit RoHS statement found; inferred from material composition table and TerraDyne's standard RoHS policy on similar SKUs", "HC-450_Datasheet_RevC.pdf", 4),
      ],
      compatibleProducts: [
        field("Compatible Pump", "TerraDyne VP-220 Variable Displacement Pump", 90, "recommendation", "Shared circuit diagram in system integration guide", "HC-450_Datasheet_RevC.pdf", 7),
        field("Compatible Valve", "TerraDyne SV-100 Solenoid Valve", 88, "recommendation", "Port thread size and flow rate match cylinder inlet spec", "HC-450_Datasheet_RevC.pdf", 7),
      ],
      replacementParts: [
        field("Seal Kit", "SK-450-V", 93, "recommendation", "Cross-referenced part number in seal kit addendum", "Seal_Kit_Spec_Addendum.pdf", 1),
        field("Rod Seal", "RS-450", 90, "recommendation", "Listed as replacement rod seal for 45mm rod diameter", "Seal_Kit_Spec_Addendum.pdf", 1),
      ],
      classification: [
        field("Industry", "Industrial Hydraulics", 96, "reasoning", "Consistent with product family and application set", "HC-450_Datasheet_RevC.pdf", 1),
        field("UNSPSC Code", "31171501", 94, "reasoning", "Matched against UNSPSC taxonomy for hydraulic cylinders", "HC-450_Datasheet_RevC.pdf", 1),
      ],
    },
    relationships: [
      { type: "compatible_with", target: "TerraDyne VP-220 Pump" },
      { type: "compatible_with", target: "TerraDyne SV-100 Valve" },
      { type: "certified_to", target: "ISO 6020/2" },
      { type: "replacement_part", target: "SK-450-V Seal Kit" },
    ],
  },
  {
    id: "vp-220",
    name: "TerraDyne VP-220 Variable Displacement Pump",
    category: "Hydraulic Pumps",
    overallConfidence: 93,
    fieldsNeedingReview: 1,
    lastUpdated: "5 hours ago",
    docs: ["VP-220_Datasheet.pdf"],
    dna: {
      technicalSpecs: [
        field("Max Flow Rate", "220 L/min", 96, "extraction", "Rated flow at 1800 rpm", "VP-220_Datasheet.pdf", 1),
        field("Max Pressure", "400 bar", 94, "extraction", "Continuous pressure rating table", "VP-220_Datasheet.pdf", 2),
        field("Displacement", "45 cm³/rev", 90, "extraction", "Displacement per revolution, spec table", "VP-220_Datasheet.pdf", 2),
      ],
    },
    relationships: [{ type: "compatible_with", target: "TerraDyne HC-450 Cylinder" }],
  },
  {
    id: "sv-100",
    name: "TerraDyne SV-100 Solenoid Valve",
    category: "Directional Valves",
    overallConfidence: 79,
    fieldsNeedingReview: 2,
    lastUpdated: "1 day ago",
    docs: ["SV-100_Datasheet.pdf"],
    dna: {
      technicalSpecs: [
        field("Valve Type", "4/3 Directional", 91, "extraction", "Circuit symbol matches 4-way 3-position", "SV-100_Datasheet.pdf", 1),
        field("Coil Voltage", "24V DC", 72, "validation", "Two coil options listed (12V / 24V); default assumed from most common order code", "SV-100_Datasheet.pdf", 3),
      ],
    },
    relationships: [{ type: "compatible_with", target: "TerraDyne HC-450 Cylinder" }],
  },
  {
    id: "nimbusflow",
    name: "NimbusFlow Workflow Automation Platform",
    category: "Enterprise SaaS",
    overallConfidence: 85,
    fieldsNeedingReview: 2,
    lastUpdated: "4 hours ago",
    docs: ["NimbusFlow_Product_Spec_v3.pdf", "NimbusFlow_Security_Whitepaper.pdf", "NimbusFlow_SOC2_Report.pdf"],
    dna: {
      technicalSpecs: [
        field("Deployment Model", "Multi-tenant Cloud SaaS", 97, "extraction", "Deployment section states 'delivered as a multi-tenant cloud service, no on-prem option'", "NimbusFlow_Product_Spec_v3.pdf", 2),
        field("API Rate Limit", "10,000 requests/min", 94, "extraction", "REST API rate limits table, standard tier row", "NimbusFlow_Product_Spec_v3.pdf", 6),
        field("Uptime SLA", "99.95%", 96, "extraction", "SLA commitment stated in service agreement summary", "NimbusFlow_Product_Spec_v3.pdf", 9),
        field("Authentication", "OAuth 2.0, SAML 2.0 SSO", 93, "extraction", "Identity & access section lists supported auth protocols", "NimbusFlow_Security_Whitepaper.pdf", 3),
        field("Data Residency", "US, EU, APAC regions", 71, "validation", "Product spec lists 'US and EU'; security whitepaper separately mentions an APAC region in beta — not yet confirmed as GA", "NimbusFlow_Security_Whitepaper.pdf", 5),
        field("Pricing Model", "Per-seat + usage-based overage", 65, "reasoning", "No single pricing table found; inferred by combining the per-seat licensing section with the API overage billing section", "NimbusFlow_Product_Spec_v3.pdf", 11),
        field("Native Integrations", "240+ connectors", 89, "extraction", "Integration marketplace count listed on product overview page", "NimbusFlow_Product_Spec_v3.pdf", 4),
      ],
      marketing: [
        field("Marketing Description", "NimbusFlow is an enterprise workflow automation platform that connects your teams, tools, and data into a single orchestration layer — cutting manual handoffs and giving IT full audit visibility.", 84, "reasoning", "Synthesized from product overview, integrations list, and security posture sections", "NimbusFlow_Product_Spec_v3.pdf", 1),
      ],
      seo: [
        field("SEO Title", "NimbusFlow – Enterprise Workflow Automation Platform", 91, "seo", "Generated from product category and core capability", "NimbusFlow_Product_Spec_v3.pdf", 1),
        field("Meta Description", "NimbusFlow automates cross-team workflows with 240+ integrations, SOC 2 Type II security, and a 99.95% uptime SLA.", 88, "seo", "Derived from confirmed technical specification fields", "NimbusFlow_Product_Spec_v3.pdf", 1),
        field("Keywords", "workflow automation, enterprise SaaS, iPaaS, process orchestration, SOC 2 compliant", 82, "seo", "Extracted from applications and compliance classification", "NimbusFlow_Product_Spec_v3.pdf", 1),
      ],
      applications: [
        field("Application", "Enterprise workflow automation", 93, "reasoning", "Listed under 'Primary Use Cases'", "NimbusFlow_Product_Spec_v3.pdf", 3),
        field("Application", "IT service management", 86, "reasoning", "Inferred from ticketing-system integration list and audit-log feature set", "NimbusFlow_Product_Spec_v3.pdf", 4),
        field("Application", "Cross-team process orchestration", 80, "reasoning", "Inferred from the multi-department connector categories in the integration marketplace", "NimbusFlow_Product_Spec_v3.pdf", 4),
      ],
      certifications: [
        field("SOC 2 Type II", "Certified", 98, "compliance", "SOC 2 report references the current audit period and named auditor", "NimbusFlow_SOC2_Report.pdf", 1),
        field("ISO 27001", "Certified", 90, "compliance", "Certificate number referenced in the security whitepaper appendix", "NimbusFlow_Security_Whitepaper.pdf", 8),
        field("GDPR Compliance", "Compliant", 85, "compliance", "Data processing addendum and EU data residency option referenced together", "NimbusFlow_Security_Whitepaper.pdf", 5),
        field("HIPAA Readiness", "Available on Enterprise tier", 58, "compliance", "No explicit HIPAA certificate found; inferred from a footnote mentioning 'BAA available for Enterprise customers'", "NimbusFlow_Security_Whitepaper.pdf", 6),
      ],
      compatibleProducts: [
        field("Data Connector Suite", "NimbusFlow Connector Suite", 92, "recommendation", "Cross-referenced in the integration marketplace as a first-party add-on", "NimbusFlow_Product_Spec_v3.pdf", 7),
        field("Analytics Add-on", "NimbusFlow Insights", 87, "recommendation", "Listed as a companion module for workflow reporting", "NimbusFlow_Product_Spec_v3.pdf", 7),
      ],
      classification: [
        field("Industry", "Enterprise Software / SaaS", 95, "reasoning", "Consistent with deployment model, licensing, and application set", "NimbusFlow_Product_Spec_v3.pdf", 1),
        field("NAICS Code", "511210 – Software Publishers", 90, "reasoning", "Matched against NAICS taxonomy for SaaS platforms", "NimbusFlow_Product_Spec_v3.pdf", 1),
      ],
    },
    relationships: [
      { type: "compatible_with", target: "NimbusFlow Connector Suite" },
      { type: "compatible_with", target: "NimbusFlow Insights" },
      { type: "certified_to", target: "SOC 2 Type II" },
      { type: "certified_to", target: "ISO 27001" },
    ],
  },
];

const flattenLowConfidence = () => {
  const items = [];
  PRODUCTS.forEach((p) => {
    Object.entries(p.dna || {}).forEach(([category, fields]) => {
      fields.forEach((f) => {
        if (f.confidence < 80) {
          items.push({ ...f, productId: p.id, productName: p.name, category });
        }
      });
    });
  });
  return items;
};

const ACTIVITY_FEED = [
  { id: 1, text: "Extraction Agent parsed HC-450_Datasheet_RevC.pdf — 14 fields drafted", time: "3m ago", agent: "extraction" },
  { id: 2, text: "Compliance Agent flagged RoHS Compliance on HC-450 (62% confidence)", time: "6m ago", agent: "compliance" },
  { id: 3, text: "Knowledge Graph Agent linked HC-450 → VP-220 (compatible_with)", time: "12m ago", agent: "knowledge_graph" },
  { id: 4, text: "J. Alvarez corrected Mounting Type on HC-450 — feedback logged", time: "38m ago", agent: "validation" },
  { id: 5, text: "SEO Agent generated metadata for SV-100", time: "1h ago", agent: "seo" },
  { id: 6, text: "Recommendation Agent linked SK-450-V as replacement part for HC-450", time: "2h ago", agent: "recommendation" },
  { id: 7, text: "Validation Agent flagged Data Residency on NimbusFlow — APAC region unconfirmed", time: "2h ago", agent: "validation" },
  { id: 8, text: "Compliance Agent verified SOC 2 Type II on NimbusFlow from audit report", time: "3h ago", agent: "compliance" },
];

const AI_INSIGHTS = [
  { id: 1, icon: AlertTriangle, tone: "amber", text: "6 fields across 3 products are sitting below the 80% confidence threshold — the RoHS claim on HC-450 is the highest priority." },
  { id: 2, icon: TrendingUp, tone: "emerald", text: "Average confidence rose 2.1 points this week after 4 validation corrections were fed back into the Extraction Agent." },
  { id: 3, icon: GitBranch, tone: "cyan", text: "Knowledge Graph Agent proposed a new compatible_with link between SV-100 and VP-220 — awaiting confirmation." },
];

const KG_TYPE_STYLE_PALETTE = [
  { fill: "#6366f1", ring: "#a5b4fc" },
  { fill: "#22d3ee", ring: "#a5f3fc" },
  { fill: "#fb7185", ring: "#fecdd3" },
  { fill: "#fb923c", ring: "#fed7aa" },
  { fill: "#a78bfa", ring: "#ddd6fe" },
  { fill: "#34d399", ring: "#a7f3d0" },
  { fill: "#71717a", ring: "#d4d4d8" },
];

/** Deterministic color per node label (e.g. "Product", "Category", "Application" — see graph_db_service.py). */
function styleForLabel(label, styleMap) {
  if (!styleMap.has(label)) {
    styleMap.set(label, KG_TYPE_STYLE_PALETTE[styleMap.size % KG_TYPE_STYLE_PALETTE.length]);
  }
  return styleMap.get(label);
}

/** Simple circular layout — the backend doesn't store x/y positions, only the graph structure. */
function layoutNodes(nodes, width = 760, height = 460) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 70;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

const COPILOT_PROMPTS = [
  "Why is Max Operating Pressure low confidence?",
  "Compare HC-450 and SV-100",
  "Generate a catalog quality report",
  "Suggest a fix for the RoHS field",
  "Why is Data Residency low confidence on NimbusFlow?",
];

const COPILOT_RESPONSES = {
  "Why is Max Operating Pressure low confidence?":
    "Max Operating Pressure on HC-450 sits at 68% confidence because the Reasoning Agent found conflicting values: the primary datasheet states 320 bar, while the Seal Kit Spec Addendum rates the assembly to 350 bar. Since no single source directly states a unified rating, the agent inferred the higher value conservatively and flagged it for human review. I'd recommend confirming with engineering before publishing.",
  "Compare HC-450 and SV-100":
    "HC-450 (Hydraulic Cylinder) has 88% overall confidence with 3 fields under review, mainly around pressure rating and mounting type. SV-100 (Solenoid Valve) sits lower at 79% confidence — its Coil Voltage field is ambiguous because the datasheet lists two coil options without a clear default. Both products are linked as compatible in the knowledge graph via a shared system integration diagram.",
  "Generate a catalog quality report":
    "Catalog snapshot: 4 products processed (3 hardware, 1 SaaS), average field confidence 87.4%. Fields below the 80% review threshold are concentrated in pressure ratings, mounting/coil ambiguity, one compliance claim (RoHS on HC-450), and one data-residency claim (NimbusFlow). Knowledge graph coverage is complete for all 4 products with 14 relationships across both the hydraulics and SaaS clusters. Recommend prioritizing RoHS and Data Residency — both affect compliance-sensitive claims.",
  "Suggest a fix for the RoHS field":
    "The RoHS Compliance field on HC-450 is inferred, not sourced directly — that's why it reads 62%. Two options: (1) request an explicit RoHS declaration document from TerraDyne and re-run the Compliance Agent against it, or (2) if no such document exists, downgrade the field to 'Not Stated' rather than 'Likely Compliant' until verified. I'd avoid publishing an inferred compliance claim as-is.",
  "Why is Data Residency low confidence on NimbusFlow?":
    "Data Residency on NimbusFlow sits at 71% confidence because two source documents partially disagree: the product spec sheet only confirms US and EU hosting, while the security whitepaper separately mentions an APAC region that's still in beta, not general availability. The Validation Agent flagged this as an unconfirmed claim rather than merging it silently — publishing 'APAC included' without confirmation could be a compliance risk for customers with regional data requirements.",
};

const RECENT_SEARCHES = ["Max Operating Pressure", "SV-100 coil voltage", "ISO 6020/2"];

/* ------------------------------------------------------------------ */
/*  Small shared UI primitives                                         */
/* ------------------------------------------------------------------ */

function Pill({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function AgentChip({ agentId }) {
  if (!agentId) return null;
  const meta = agentMeta(agentId);
  const style = AGENT_STYLES[agentId];
  const Icon = meta.icon;
  return (
    <Pill className={`${style.bg} ${style.border} ${style.text}`}>
      <Icon className="h-3 w-3" />
      {meta.name.replace(" Agent", "")}
    </Pill>
  );
}

function ConfidenceBadge({ value, compact = false }) {
  const s = confidenceStyle(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${s.bg} ${s.border} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.bar}`} />
      <CountUp value={value} suffix="%" />
      {!compact && <span className="hidden font-sans font-normal text-zinc-500 sm:inline">&nbsp;{s.label}</span>}
    </span>
  );
}

/** Premium card: soft border, subtle gradient sheen, lift + glow on hover. */
function Card({ children, className = "", interactive = false, as = "div" }) {
  const Comp = as;
  return (
    <Comp
      className={`group relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/70 to-zinc-900/40 shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset] backdrop-blur-sm transition-all duration-300 ${
        interactive ? "hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]" : ""
      } ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {children}
    </Comp>
  );
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-indigo-400">
            <span className="h-1 w-1 rounded-full bg-indigo-400" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-50">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Animated count-up number, used across KPIs and confidence badges. */
function CountUp({ value, suffix = "", decimals = 0, duration = 0.9 }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    mv.set(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => spring.on("change", (v) => setDisplay(v)), [spring]);

  return <span>{display.toFixed(decimals)}{suffix}</span>;
}

/** Reusable button with hover / click / loading / disabled / success states. */
function Button({ children, variant = "secondary", size = "md", loading = false, success = false, icon: Icon, className = "", ...props }) {
  const base = "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm", icon: "h-9 w-9" };
  const variants = {
    primary: "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset]",
    secondary: "border border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700",
    ghost: "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
    success: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    danger: "border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
  };
  return (
    <motion.button
      whileHover={{ scale: props.disabled ? 1 : 1.02 }}
      whileTap={{ scale: props.disabled ? 1 : 0.97 }}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {children}
          </motion.span>
        ) : success ? (
          <motion.span key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5" /> Done
          </motion.span>
        ) : (
          <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Circular confidence ring, used on product cards. */
function ConfidenceRing({ value, size = 44 }) {
  const theme = useTheme();
  const s = confidenceStyle(value);
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProgress(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={theme === "light" ? "#e4e4e7" : "#27272a"} strokeWidth="4" fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={s.solid}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (progress / 100) * c }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-mono text-[10px] font-bold tabular-nums ${s.text}`}>{value}</span>
      </div>
    </div>
  );
}

/** Skeleton shimmer block for loading states. */
function Skeleton({ className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-zinc-800/60 ${className}`}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
        animate={{ translateX: ["-100%", "100%"] }}
        transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
      />
    </div>
  );
}

/** Empty state with icon, message, subtle animation and a CTA. */
function EmptyState({ icon: Icon = Sparkles, title, description, action }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-indigo-400"
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description && <p className="max-w-sm text-xs text-zinc-500">{description}</p>}
      {action}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Explainable field row                                              */
/* ------------------------------------------------------------------ */

function FieldRow({ f, onAccept, onFlag }) {
  const [open, setOpen] = useState(false);
  const s = confidenceStyle(f.confidence);
  return (
    <Card interactive className={open ? "border-zinc-700" : ""}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{f.label}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-100">{f.value}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AgentChip agentId={f.agent} />
          <ConfidenceBadge value={f.confidence} compact />
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </motion.span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="relative overflow-hidden border-t border-zinc-800"
          >
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3">
                {f.evidence && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      <Info className="h-3.5 w-3.5" /> Evidence
                    </p>
                    <p className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm italic text-zinc-300">
                      &ldquo;{f.evidence}&rdquo;
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
                  {f.sourceDoc && <span className="flex items-center gap-1.5"><FileStack className="h-3.5 w-3.5" /> {f.sourceDoc}</span>}
                  {f.page && <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Page {f.page}</span>}
                  {f.agent && (
                    <span className="flex items-center gap-1.5">
                      {React.createElement(agentMeta(f.agent).icon, { className: "h-3.5 w-3.5" })}
                      Generated by {agentMeta(f.agent).name}
                    </span>
                  )}
                  {!f.evidence && !f.sourceDoc && !f.agent && (
                    <span className="italic text-zinc-600">No provenance detail available for this field yet.</span>
                  )}
                </div>
              </div>
              {f.confidence < 80 && (
                <div className="flex shrink-0 items-start gap-2 sm:flex-col">
                  <Button variant="success" size="sm" icon={Check} onClick={() => onAccept && onAccept(f)}>Accept</Button>
                  <Button variant="secondary" size="sm" icon={Flag} onClick={() => onFlag && onFlag(f)}>Send to review</Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Command palette (Ctrl+K)                                            */
/* ------------------------------------------------------------------ */

const SEARCH_INDEX = [
  { type: "product", label: "TerraDyne HC-450 Hydraulic Cylinder", sub: "Hydraulic Cylinders", productId: "hc-450" },
  { type: "product", label: "TerraDyne VP-220 Variable Displacement Pump", sub: "Hydraulic Pumps", productId: "vp-220" },
  { type: "product", label: "TerraDyne SV-100 Solenoid Valve", sub: "Directional Valves", productId: "sv-100" },
  { type: "product", label: "NimbusFlow Workflow Automation Platform", sub: "Enterprise SaaS", productId: "nimbusflow" },
  { type: "field", label: "Max Operating Pressure", sub: "HC-450 · 68% confidence", productId: "hc-450" },
  { type: "field", label: "Coil Voltage", sub: "SV-100 · 72% confidence", productId: "sv-100" },
  { type: "field", label: "Data Residency", sub: "NimbusFlow · 71% confidence", productId: "nimbusflow" },
  { type: "document", label: "HC-450_Datasheet_RevC.pdf", sub: "8 pages · linked to 3 products", productId: "hc-450" },
  { type: "document", label: "NimbusFlow_SOC2_Report.pdf", sub: "linked to NimbusFlow Platform", productId: "nimbusflow" },
];

function CommandPalette({ open, onClose, onNavigate, onOpenProduct }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchApi
        .query(q)
        .then((res) => {
          const products = (res.products || []).map((p) => ({ type: "product", label: p.title, sub: "Product", productId: p.id }));
          const uploads = (res.uploads || []).map((u) => ({ type: "upload", label: u.title, sub: "Uploaded file", productId: null }));
          setResults([...products, ...uploads]);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const choose = (r) => {
    if (r.productId) onOpenProduct(r.productId);
    else onNavigate("pipeline"); // uploads have no dedicated detail view yet — send to Pipeline
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + results.length) % results.length); }
    if (e.key === "Enter") { e.preventDefault(); choose(results[activeIndex]); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search products and uploaded files…"
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">esc</kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {!query.trim() && (
                <p className="px-3 py-6 text-center text-sm text-zinc-600">Start typing to search products and uploaded files.</p>
              )}

              {query.trim() && loading && <p className="px-3 py-6 text-center text-sm text-zinc-600">Searching…</p>}

              {query.trim() && !loading && results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-zinc-600">No results for &ldquo;{query}&rdquo;</p>
              )}

              {!loading && results.map((r, i) => (
                <button
                  key={`${r.type}-${r.label}-${i}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(r)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    activeIndex === i ? "bg-indigo-500/10" : "hover:bg-zinc-900"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                      {r.type === "product" ? <Package className="h-3.5 w-3.5 text-indigo-400" /> : <FileStack className="h-3.5 w-3.5 text-zinc-400" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-200">{r.label}</span>
                      <span className="block truncate text-xs text-zinc-500">{r.sub}</span>
                    </span>
                  </span>
                  {activeIndex === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2.5 text-[11px] text-zinc-600">
              <span className="flex items-center gap-1"><kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono">↵</kbd> open</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar + Topbar                                                   */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pipeline", label: "Live Pipeline", icon: Zap },
  { id: "products", label: "Products", icon: Package },
  { id: "graph", label: "Knowledge Graph", icon: Share2 },
  { id: "validation", label: "Validation Queue", icon: ListChecks },
  { id: "copilot", label: "AI Copilot", icon: MessageSquare },
];

function Sidebar({ view, setView, queueCount, onOpenSettings, onGoHome }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <button onClick={onGoHome} className="flex items-center gap-2.5 border-b border-zinc-800 px-5 py-5 text-left transition-colors hover:bg-zinc-900/60">
        <motion.div
          whileHover={{ rotate: 8, scale: 1.05 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_4px_12px_-2px_rgba(99,102,241,0.5)]"
        >
          <Sparkles className="h-4 w-4 text-white" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold leading-none tracking-tight text-zinc-100">Catalyst</p>
          <p className="mt-1 text-[11px] leading-none text-zinc-500">Product Intelligence</p>
        </div>
      </button>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                active ? "text-indigo-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg border border-indigo-500/30 bg-indigo-500/10"
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.id === "validation" && queueCount > 0 && (
                <span className="relative z-10 rounded-full bg-rose-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-rose-400">
                  {queueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 px-3 py-4">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
      </div>
    </aside>
  );
}

function NotificationDropdown({ notify, onViewAll }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const unreadCount = items.filter((i) => !readIds.has(i.id)).length;

  const load = () => {
    setLoading(true);
    setError("");
    notificationsApi
      .list()
      .then((res) => setItems(res || []))
      .catch((err) => setError(err?.detail || err?.message || "Couldn't load notifications."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Simple periodic refresh since there's no push channel for the bell (pipeline
    // job updates already stream live over the /pipeline/ws WebSocket separately).
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = (id) => setReadIds((prev) => new Set(prev).add(id));
  const markAllRead = () => {
    setReadIds(new Set(items.map((i) => i.id)));
    notify?.("All notifications marked as read.");
  };

  const timeAgo = (iso) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <p className="text-sm font-medium text-zinc-200">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300">
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {loading && <p className="px-4 py-6 text-center text-xs text-zinc-600">Loading…</p>}
              {!loading && error && <p className="px-4 py-6 text-center text-xs text-rose-400">{error}</p>}
              {!loading && !error && items.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-zinc-600">You're all caught up.</p>
              )}
              {!loading && !error && items.map((e) => {
                const read = readIds.has(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => markRead(e.id)}
                    className="flex w-full items-start gap-2.5 border-b border-zinc-900 px-4 py-3 text-left last:border-0 hover:bg-zinc-900/50"
                  >
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${read ? "bg-zinc-700" : "bg-amber-400"}`} />
                    <div className="min-w-0">
                      <p className={`text-xs leading-relaxed ${read ? "text-zinc-500" : "text-zinc-300"}`}>{e.message}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">{timeAgo(e.created_at)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setOpen(false); onViewAll?.(); }}
              className="flex w-full items-center justify-center gap-1.5 border-t border-zinc-800 px-4 py-2.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            >
              View all activity <ArrowRight className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkspaceSelector({ notify }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("Production");
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div className="relative hidden lg:block" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-semibold text-zinc-300">TD</span>
        TerraDyne Industrial <span className="text-zinc-700">·</span> {selected}
        <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-600" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl shadow-black/50"
          >
            {["Production", "Staging", "Sandbox"].map((w) => (
              <button
                key={w}
                onClick={() => {
                  setSelected(w);
                  setOpen(false);
                  notify?.(`Switched to the ${w} workspace.`);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-900"
              >
                {w} {w === selected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu({ notify, onOpenSettings, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const user = useUser();
  const initials = (user.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = [
    { label: "Profile", icon: User, action: () => onOpenSettings?.("profile") },
    { label: "Help & docs", icon: HelpCircle, action: () => notify?.("Help & docs would open in a new tab in production.") },
    { label: "Sign out", icon: LogOut, action: () => onSignOut?.() },
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Profile menu" className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 font-mono text-xs text-zinc-300 ring-1 ring-zinc-700 transition-transform hover:scale-105">
        {initials}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl shadow-black/50"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-medium text-zinc-200">{user.name || "User"}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
              {user.company && <p className="mt-1 truncate text-[11px] text-zinc-600">{user.role} · {user.company}</p>}
            </div>
            <div className="my-1 h-px bg-zinc-900" />
            {items.map((i) => (
              <button
                key={i.label}
                onClick={() => { setOpen(false); i.action(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              >
                <i.icon className="h-3.5 w-3.5" /> {i.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopBar({ onOpenPalette, notify, onOpenSettings, onViewAllActivity, theme, onToggleTheme, onSignOut }) {
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || "");
  return (
    <header className="relative z-30 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500 md:hidden">
        <Sparkles className="h-4 w-4 text-indigo-400" /> Catalyst
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenPalette}
          className="hidden items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:border-zinc-700 md:flex md:w-80"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left text-zinc-600">Search products, documents, fields…</span>
          <kbd className="flex items-center gap-0.5 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
            {isMac ? <Command className="h-2.5 w-2.5" /> : "Ctrl"}K
          </kbd>
        </button>
        <WorkspaceSelector notify={notify} />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 lg:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          All agents operational
        </span>
        <button
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          onClick={() => {
            onToggleTheme();
            notify?.(theme === "light" ? "Switched to dark mode." : "Switched to light mode.");
          }}
         className="flex rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200" 
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <NotificationDropdown notify={notify} onViewAll={onViewAllActivity} />
        <ProfileMenu notify={notify} onOpenSettings={onOpenSettings} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

function KPICard({ label, value, decimals = 0, suffix = "", sub, icon: Icon, accent, trend }) {
  return (
    <Card interactive className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/60 ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-zinc-100">
        <CountUp value={value} decimals={decimals} suffix={suffix} />
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-400">
            <ArrowUpRight className="h-3 w-3" /> {trend}
          </span>
        )}
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
    </Card>
  );
}

function Dashboard({ setView, openProduct }) {
  const theme = useTheme();
  const chartTick = theme === "light" ? "#71717a" : "#71717a";
  const chartAxisLine = theme === "light" ? "#e4e4e7" : "#27272a";
  const tooltipBg = theme === "light" ? "#ffffff" : "#18181b";
  const tooltipBorder = theme === "light" ? "#e4e4e7" : "#27272a";
  const tooltipLabel = theme === "light" ? "#18181b" : "#e4e4e7";

  const [overview, setOverview] = useState(null);
  const [series, setSeries] = useState([]);
  const [pendingCount, setPendingCount] = useState(null);
  const [recentProducts, setRecentProducts] = useState([]);
  const [statusCounts, setStatusCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const statuses = ["draft", "pending_review", "approved", "rejected", "published"];
    Promise.all([
      analyticsApi.overview(30),
      analyticsApi.timeSeries(7),
      productsApi.list({ status: "pending_review", page_size: 1 }),
      productsApi.list({ sort_by: "created_at", sort_dir: "desc", page_size: 5 }),
      Promise.all(statuses.map((s) => productsApi.list({ status: s, page_size: 1 }))),
    ])
      .then(([ov, ts, pending, recent, statusResults]) => {
        if (cancelled) return;
        setOverview(ov);
        setSeries(ts);
        setPendingCount(pending.total ?? 0);
        setRecentProducts(recent.items || []);
        setStatusCounts(Object.fromEntries(statuses.map((s, i) => [s, statusResults[i].total ?? 0])));
      })
      .catch((err) => !cancelled && setError(err?.detail || err?.message || "Couldn't load dashboard data."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData = series.map((d) => ({
    day: d.day ? new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "",
    jobs: d.jobs || 0,
  }));

  return (
    <div>
      <SectionHeading
        eyebrow="Overview"
        title="Catalog Intelligence Dashboard"
        description="A live view of what your multi-agent pipeline has processed, flagged, and learned."
        action={
          <Button variant="primary" icon={UploadCloud} onClick={() => setView("pipeline")}>New upload</Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p className="text-xs leading-relaxed text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard label="Products Processed" value={overview?.total_products_generated ?? 0} sub="last 30 days" icon={Package} accent="text-indigo-400" />
          <KPICard
            label="Avg. Product Confidence"
            value={overview?.avg_confidence_score != null ? overview.avg_confidence_score * 100 : 0}
            decimals={1}
            suffix="%"
            sub="last 30 days"
            icon={Gauge}
            accent="text-emerald-400"
          />
          <KPICard label="Products Needing Review" value={pendingCount ?? 0} sub="in the validation queue" icon={AlertTriangle} accent="text-amber-400" />
          <KPICard
            label="Extraction Success Rate"
            value={overview?.extraction_success_rate != null ? overview.extraction_success_rate * 100 : 0}
            decimals={1}
            suffix="%"
            sub="jobs succeeded, last 30 days"
            icon={TrendingUp}
            accent="text-cyan-400"
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Processing volume</p>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500"><Activity className="h-3.5 w-3.5" /> Jobs started, last 7 days</span>
          </div>
          <div className="h-52">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-600">No processing jobs in this window yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={36}>
                  <XAxis dataKey="day" tick={{ fill: chartTick, fontSize: 12 }} axisLine={{ stroke: chartAxisLine }} tickLine={false} />
                  <YAxis tick={{ fill: chartTick, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(127,127,127,0.08)" }}
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: tooltipLabel }}
                  />
                  <Bar dataKey="jobs" name="Jobs" radius={[6, 6, 0, 0]} fill="#6366f1" isAnimationActive animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 text-sm font-medium text-zinc-300">Pipeline agents</p>
          <div className="space-y-3">
            {AGENTS.map((a) => {
              const style = AGENT_STYLES[a.id];
              const Icon = a.icon;
              return (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-zinc-300">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md ${style.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${style.text}`} />
                    </span>
                    {a.name.replace(" Agent", "")}
                  </span>
                  <span className="text-xs text-zinc-600">in pipeline</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="mb-3 text-sm font-medium text-zinc-300">Recently generated products</p>
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentProducts.length === 0 ? (
            <p className="text-sm text-zinc-600">Nothing processed yet — run an upload from the Pipeline view to see activity here.</p>
          ) : (
            <div className="space-y-2">
              {recentProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProduct(p.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-zinc-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200">{p.name}</p>
                    <p className="text-xs text-zinc-500">{new Date(p.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  {p.confidence_score != null && <ConfidenceBadge value={Math.round(p.confidence_score * 100)} compact />}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-4 text-sm font-medium text-zinc-300">Products by status</p>
          {loading || !statusCounts ? (
            <div className="space-y-2.5">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : Object.values(statusCounts).every((c) => c === 0) ? (
            <p className="text-sm text-zinc-600">No products yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(statusCounts).map(([status, count]) => {
                const style = STATUS_STYLE[status] || STATUS_STYLE.draft;
                return (
                  <button
                    key={status}
                    onClick={() => setView("products")}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left transition-colors hover:border-zinc-700"
                  >
                    <Pill className={style.cls}>{style.label}</Pill>
                    <span className="font-mono text-sm text-zinc-300">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SourceInputForm({ sources, setSources, fileInputRef }) {
  const sourceCount =
    (sources.fileName ? 1 : 0) + (sources.cloudUrl.trim() ? 1 : 0) + (sources.externalUrl.trim() ? 1 : 0) + (sources.description.trim() ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">Product sources</p>
        {sourceCount > 0 && (
          <Pill className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
            <Boxes className="h-3 w-3" /> {sourceCount} source{sourceCount > 1 ? "s" : ""} added
          </Pill>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setSources((s) => ({ ...s, fileName: f?.name || null, file: f || null }));
          }}
          accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
            sources.fileName ? "border-indigo-500/40 bg-indigo-500/5" : "border-dashed border-zinc-800 bg-zinc-950 hover:border-zinc-700"
          }`}
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sources.fileName ? "bg-indigo-500/10" : "bg-zinc-900"}`}>
            <UploadCloud className={`h-4 w-4 ${sources.fileName ? "text-indigo-400" : "text-zinc-500"}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm text-zinc-200">{sources.fileName ? sources.fileName : "Upload PDF, DOCX or Excel"}</span>
            <span className="block text-xs text-zinc-500">{sources.fileName ? "Ready to process" : "Datasheet, spec sheet, product catalog"}</span>
          </span>
        </button>

        <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${sources.cloudUrl.trim() ? "border-indigo-500/40 bg-indigo-500/5" : "border-zinc-800 bg-zinc-950"}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sources.cloudUrl.trim() ? "bg-indigo-500/10" : "bg-zinc-900"}`}>
            <ExternalLink className={`h-4 w-4 ${sources.cloudUrl.trim() ? "text-indigo-400" : "text-zinc-500"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-xs text-zinc-500">Cloud / File URL</span>
            <input
              value={sources.cloudUrl}
              onChange={(e) => setSources((s) => ({ ...s, cloudUrl: e.target.value }))}
              placeholder="https://res.cloudinary.com/…/motor-im500.jpg"
              className="w-full truncate bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </span>
        </label>

        <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${sources.externalUrl.trim() ? "border-indigo-500/40 bg-indigo-500/5" : "border-zinc-800 bg-zinc-950"}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sources.externalUrl.trim() ? "bg-indigo-500/10" : "bg-zinc-900"}`}>
            <Share2 className={`h-4 w-4 ${sources.externalUrl.trim() ? "text-indigo-400" : "text-zinc-500"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-xs text-zinc-500">External source (manufacturer site, etc.)</span>
            <input
              value={sources.externalUrl}
              onChange={(e) => setSources((s) => ({ ...s, externalUrl: e.target.value }))}
              placeholder="https://manufacturer.com/products/im500"
              className="w-full truncate bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </span>
        </label>

        <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${sources.description.trim() ? "border-indigo-500/40 bg-indigo-500/5" : "border-zinc-800 bg-zinc-950"}`}>
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sources.description.trim() ? "bg-indigo-500/10" : "bg-zinc-900"}`}>
            <FileText className={`h-4 w-4 ${sources.description.trim() ? "text-indigo-400" : "text-zinc-500"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 block text-xs text-zinc-500">Additional information (not yet sent to pipeline)</span>
            <textarea
              value={sources.description}
              onChange={(e) => setSources((s) => ({ ...s, description: e.target.value }))}
              placeholder="3-phase industrial motor suitable for heavy-duty manufacturing applications."
              rows={1}
              className="w-full resize-none bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </span>
        </label>
      </div>
    </div>
  );
}

function EvidencePopover({ field, sourcesUsed, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full z-20 mt-2 w-72 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <p className="text-sm font-medium text-zinc-200">{field}: sources</p>
        <button onClick={onClose} className="rounded-md p-0.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="space-y-2 px-4 py-3">
        {sourcesUsed.map((s) => {
          const Icon = s.icon;
          return (
            <p key={s.id} className="flex items-center gap-2 text-xs text-zinc-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <span className="truncate">{s.label}</span>
            </p>
          );
        })}
      </div>
      <div className="border-t border-zinc-800 bg-zinc-900/40 px-4 py-2 text-[11px] text-emerald-400">
        Sources agree → confidence boosted
      </div>
    </motion.div>
  );
}

function ConflictCard({ resolved, onApprove }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (resolved) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-sm text-emerald-300">Weight = 45 kg <span className="text-emerald-400/80">· Human Verified</span></p>
      </motion.div>
    );
  }

  return (
    <div className="relative rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
        <AlertTriangle className="h-4 w-4" /> Weight Conflict
      </p>
      <div className="mt-2.5 space-y-1.5 text-sm text-zinc-300">
        {IM500_CONFLICT.options.map((o) => (
          <p key={o.value} className="flex items-center gap-1.5">
            <span className="font-mono text-zinc-100">{o.value}</span>
            <span className="text-zinc-500">→ {o.sourceIds.length} source{o.sourceIds.length > 1 ? "s" : ""}</span>
          </p>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-zinc-500">
        Confidence: <span className="font-mono text-amber-400">{IM500_CONFLICT.confidence}%</span> · Status: <span className="font-medium text-amber-400">NEEDS REVIEW</span>
      </p>
      <div className="relative mt-3 flex gap-2">
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => setSourcesOpen((v) => !v)}>View Sources</Button>
        <Button variant="success" size="sm" icon={Check} onClick={onApprove}>Approve 45 kg</Button>
        <AnimatePresence>
          {sourcesOpen && (
            <EvidencePopover
              field="Weight"
              sourcesUsed={IM500_SOURCES}
              onClose={() => setSourcesOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProductProfilePreview({ weightResolved }) {
  const [openField, setOpenField] = useState(null);
  const sourceLookup = Object.fromEntries(IM500_SOURCES.map((s) => [s.id, s]));
  const fields = [
    ...IM500_FIELDS,
    { label: "Weight", value: "45 kg", confidence: weightResolved ? 100 : 72, sources: weightResolved ? ["pdf", "excel"] : ["pdf", "excel", "website"] },
  ];
  const overallConfidence = weightResolved ? 95 : 88;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 ring-1 ring-inset ring-indigo-500/20">
            <Cpu className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Industrial Motor A</p>
            <p className="text-xs text-zinc-500">Model IM500 · Industrial Motors</p>
          </div>
        </div>
        <ConfidenceBadge value={overallConfidence} />
      </div>

      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <Gauge className="h-3.5 w-3.5" /> Specifications
      </div>
      <div className="space-y-1.5">
        {fields.map((f) => (
          <div key={f.label} className="relative flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
            <button onClick={() => setOpenField(openField === f.label ? null : f.label)} className="flex flex-1 items-center justify-between text-left">
              <span className="text-sm text-zinc-300">{f.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm text-zinc-100">{f.value}</span>
                <ConfidenceBadge value={f.confidence} compact />
              </span>
            </button>
            <AnimatePresence>
              {openField === f.label && (
                <EvidencePopover
                  field={f.label}
                  sourcesUsed={f.sources.map((id) => sourceLookup[id])}
                  onClose={() => setOpenField(null)}
                />
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Applications</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill className="border-zinc-800 bg-zinc-900 text-zinc-400">Manufacturing machinery</Pill>
            <Pill className="border-zinc-800 bg-zinc-900 text-zinc-400">Industrial equipment</Pill>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Related Products</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Component B</Pill>
            <Pill className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">Controller X</Pill>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
        <span className={`flex items-center gap-1.5 text-sm font-medium ${weightResolved ? "text-emerald-400" : "text-amber-400"}`}>
          <BadgeCheck className="h-4 w-4" /> {weightResolved ? "VERIFIED" : "1 field needs review"}
        </span>
        <Button variant="secondary" size="sm">Add to catalog</Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Live Pipeline                                                       */
/* ------------------------------------------------------------------ */

function PipelineView({ openProduct }) {
  const [sources, setSources] = useState({ fileName: null, file: null, cloudUrl: "", externalUrl: "", description: "" });
  const [running, setRunning] = useState(false);
  const [stageIndex, setStageIndex] = useState(-1);
  const [log, setLog] = useState([]);
  const [jobStatus, setJobStatus] = useState(null); // "running" | "succeeded" | "failed" | "needs_review"
  const [jobError, setJobError] = useState("");
  const [weightResolved, setWeightResolved] = useState(false);
  const fileInputRef = useRef(null);
  const stopWatchingRef = useRef(null);
  const pollTimerRef = useRef(null);

  const hasAnySource = !!(sources.fileName || sources.cloudUrl.trim() || sources.externalUrl.trim());

  const stageIdx = (stageId) => PIPELINE_STAGES.findIndex((s) => s.id === stageId);

  const applyStageEvent = (evt) => {
    // evt: { stage, status, progress_pct, message } — see workers/tasks.py
    const idx = stageIdx(evt.stage);
    if (idx === -1) return;
    setStageIndex((prev) => Math.max(prev, idx));
    setLog((prev) => {
      const stageMeta = PIPELINE_STAGES[idx];
      const text = evt.message || `${stageMeta.label} — ${evt.status}`;
      // Replace the entry for this stage if we already logged it (e.g. a
      // RUNNING event followed by a SUCCEEDED event for the same stage),
      // otherwise append.
      const existingAt = prev.findIndex((l) => l.stageId === evt.stage);
      const entry = { id: prev.length, stageId: evt.stage, text, agent: stageMeta.agent };
      if (existingAt !== -1) {
        const next = [...prev];
        next[existingAt] = { ...entry, id: prev[existingAt].id };
        return next;
      }
      return [...prev, entry];
    });
    if (evt.status === "failed") {
      setJobStatus("failed");
      setJobError(evt.message || "Processing failed.");
      setRunning(false);
    } else if (evt.stage === "completed") {
      setJobStatus("succeeded");
      setRunning(false);
    } else if (evt.stage === "human_review") {
      setJobStatus("needs_review");
    }
  };

  const stopTracking = () => {
    if (stopWatchingRef.current) {
      stopWatchingRef.current();
      stopWatchingRef.current = null;
    }
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const trackJob = (jobId) => {
    // Prefer the WebSocket for live updates; fall back to short polling if
    // it errors (e.g. proxy/network doesn't support the upgrade).
    let usingPoll = false;
    const startPolling = () => {
      if (usingPoll) return;
      usingPoll = true;
      pollTimerRef.current = setInterval(async () => {
        try {
          const job = await pipelineApi.getJob(jobId);
          applyStageEvent({ stage: job.current_stage, status: job.status, message: job.error_message });
          if (["succeeded", "failed"].includes(job.status) || job.current_stage === "completed") {
            stopTracking();
          }
        } catch {
          stopTracking();
          setJobStatus("failed");
          setJobError("Lost connection to the server.");
          setRunning(false);
        }
      }, 1500);
    };

    stopWatchingRef.current = pipelineApi.watchJob(jobId, applyStageEvent, () => startPolling());
    // Also poll once immediately in case the WS misses the very first event.
    pipelineApi.getJob(jobId).then((job) => applyStageEvent({ stage: job.current_stage, status: job.status })).catch(() => {});
  };

  const start = async () => {
    if (!hasAnySource || running) return;
    stopTracking();
    setRunning(true);
    setStageIndex(-1);
    setLog([]);
    setJobStatus(null);
    setJobError("");
    setWeightResolved(false);
    try {
      let res;
      if (sources.file) {
        res = await uploadApi.file(sources.file);
      } else {
        res = await uploadApi.website(sources.cloudUrl.trim() || sources.externalUrl.trim());
      }
      if (!res.processing_job_id) throw new Error("Upload succeeded but no processing job was created.");
      trackJob(res.processing_job_id);
    } catch (err) {
      setRunning(false);
      setJobStatus("failed");
      setJobError(err?.detail || err?.message || "Upload failed. Please try again.");
    }
  };

  useEffect(() => stopTracking, []);

  const done = jobStatus === "succeeded" || jobStatus === "needs_review";

  return (
    <div>
      <SectionHeading
        eyebrow="Live Pipeline"
        title="Multiple Sources → One Trusted Product Profile"
        description="Give Catalyst whatever you have — a file, a URL, or a few lines of text. Every stage below is a real step your sources pass through, and conflicts between sources are surfaced, never hidden."
      />

      <Card className="p-6">
        <SourceInputForm sources={sources} setSources={setSources} fileInputRef={fileInputRef} />

        <div className="mt-5 flex justify-end">
          <Button variant="primary" loading={running} icon={Sparkles} onClick={start} disabled={running || !hasAnySource}>
            {running ? "Processing…" : "Generate Product Intelligence"}
          </Button>
        </div>

        <div className="mt-8 overflow-x-auto pb-2">
          <div className="flex min-w-[980px] items-center">
            {PIPELINE_STAGES.map((stage, i) => {
              const state = i < stageIndex || done ? "done" : i === stageIndex ? "active" : "pending";
              const Icon = stage.icon;
              const style = stage.agent ? AGENT_STYLES[stage.agent] : { text: "text-zinc-400", bg: "bg-zinc-800", border: "border-zinc-700", dot: "bg-zinc-500", solid: "#a1a1aa" };
              return (
                <React.Fragment key={stage.id}>
                  <div className="flex flex-col items-center gap-2" style={{ width: 84 }}>
                    <div className="relative flex h-11 w-11 items-center justify-center">
                      {state === "active" && (
                        <motion.span
                          className="absolute inset-0 rounded-full"
                          style={{ boxShadow: `0 0 0 0 ${style.solid}55` }}
                          animate={{ boxShadow: [`0 0 0 0 ${style.solid}55`, `0 0 0 8px ${style.solid}00`] }}
                          transition={{ repeat: Infinity, duration: 1.1 }}
                        />
                      )}
                      <motion.div
                        animate={state === "active" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                        transition={{ repeat: state === "active" ? Infinity : 0, duration: 0.9 }}
                        className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                          state === "done"
                            ? "border-emerald-500 bg-emerald-500/10"
                            : state === "active"
                            ? `${style.border} ${style.bg}`
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                        style={state === "active" ? { boxShadow: `0 0 16px 0 ${style.solid}66` } : undefined}
                      >
                        {state === "done" ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                            <Check className="h-5 w-5 text-emerald-400" />
                          </motion.div>
                        ) : (
                          <Icon className={`h-5 w-5 ${state === "active" ? style.text : "text-zinc-600"}`} />
                        )}
                      </motion.div>
                    </div>
                    <p className={`text-center text-[10.5px] leading-tight ${state === "pending" ? "text-zinc-600" : "text-zinc-300"}`}>
                      {stage.label}
                    </p>
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className="relative mx-1 h-0.5 flex-1 rounded bg-zinc-800">
                      <motion.div
                        className="h-0.5 rounded bg-gradient-to-r from-emerald-500 to-emerald-400"
                        initial={{ width: "0%" }}
                        animate={{ width: i < stageIndex || done ? "100%" : "0%" }}
                        transition={{ duration: 0.4 }}
                      />
                      {i === stageIndex - 1 && running && (
                        <motion.div
                          className="absolute inset-y-0 left-0 w-3 rounded-full bg-white/60 blur-[2px]"
                          animate={{ left: ["0%", "100%"] }}
                          transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                        />
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {jobStatus === "failed" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className="text-sm text-rose-300">Processing failed.</p>
              {jobError && <p className="mt-0.5 text-xs text-rose-400/80">{jobError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              <div className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 ${jobStatus === "needs_review" ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                {jobStatus === "needs_review" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <p className={`text-sm ${jobStatus === "needs_review" ? "text-amber-300" : "text-emerald-300"}`}>
                  {jobStatus === "needs_review" ? "Processed — some fields need human review." : "Sources fused into one product profile."}
                </p>
              </div>
              <ConflictCard resolved={weightResolved} onApprove={() => setWeightResolved(true)} />
              <Card className="p-5">
                <p className="mb-3 text-sm font-medium text-zinc-300">Agent activity log</p>
                <div className="max-h-56 space-y-2.5 overflow-y-auto">
                  {log.map((l) => (
                    <motion.div key={l.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 font-mono text-xs text-zinc-400">
                      <span className="text-zinc-600">{String(l.id + 1).padStart(2, "0")}</span>
                      {l.agent && <AgentChip agentId={l.agent} />}
                      <span>{l.text}</span>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>
            <ProductProfilePreview weightResolved={weightResolved} />
          </motion.div>
        )}
      </AnimatePresence>

      {!done && (
        <Card className="mt-4 p-5">
          <p className="mb-3 text-sm font-medium text-zinc-300">Agent activity log</p>
          {log.length === 0 ? (
            running ? (
              <div className="space-y-2.5">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4 w-full max-w-md" />)}
              </div>
            ) : (
              <p className="text-sm text-zinc-600">Add at least one source above and generate to see each agent's reasoning appear here in real time.</p>
            )
          ) : (
            <div className="space-y-2.5">
              {log.map((l) => (
                <motion.div key={l.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 font-mono text-xs text-zinc-400">
                  <span className="text-zinc-600">{String(l.id + 1).padStart(2, "0")}</span>
                  {l.agent && <AgentChip agentId={l.agent} />}
                  <span>{l.text}</span>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Products list + detail (Product DNA)                               */
/* ------------------------------------------------------------------ */

const STATUS_STYLE = {
  draft: { label: "Draft", cls: "border-zinc-700 bg-zinc-800/60 text-zinc-400" },
  pending_review: { label: "Needs review", cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  approved: { label: "Approved", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  rejected: { label: "Rejected", cls: "border-rose-500/30 bg-rose-500/10 text-rose-400" },
  published: { label: "Published", cls: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400" },
};

function ProductsList({ openProduct }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    setError("");
    try {
      const res = await productsApi.list({ search: searchTerm || undefined, page_size: 60 });
      setItems(res.items || []);
    } catch (err) {
      setError(err?.detail || err?.message || "Couldn't load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div>
      <SectionHeading eyebrow="Catalog" title="Products" description="Every SKU your pipeline has processed, with explainable confidence at a glance." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU or description…"
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500"
        />
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() => exportApi.downloadProductsCsv().catch((err) => setError(err?.message || "Export failed."))}
        >
          Export CSV
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p className="text-xs leading-relaxed text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-600">No products yet — run an upload from the Pipeline view to get started.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p, idx) => {
            const statusStyle = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
            const conf = p.confidence_score != null ? Math.round(p.confidence_score * 100) : null;
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => openProduct(p.id)}
              >
                <Card interactive className="h-full p-5 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 ring-1 ring-inset ring-indigo-500/20">
                      <Wrench className="h-5 w-5 text-indigo-400" />
                    </div>
                    {conf != null && <ConfidenceRing value={conf} />}
                  </div>
                  <p className="mt-4 text-sm font-medium leading-snug text-zinc-100">{p.name}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {p.category && <Pill className="border-zinc-800 bg-zinc-900 text-zinc-400">{p.category}</Pill>}
                    <Pill className={statusStyle.cls}>
                      {p.status === "pending_review" ? <CircleDot className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
                      {statusStyle.label}
                    </Pill>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                    <span>{conf != null ? `${conf}% confidence` : "Confidence pending"}</span>
                    <span>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</span>
                  </div>
                </Card>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DNA_TABS = [
  { id: "technicalSpecs", label: "Technical Specs" },
  { id: "marketing", label: "Marketing" },
  { id: "seo", label: "SEO Metadata" },
  { id: "applications", label: "Applications" },
  { id: "certifications", label: "Certifications" },
  { id: "compatibleProducts", label: "Compatible Products" },
  { id: "replacementParts", label: "Replacement Parts" },
  { id: "classification", label: "Classification" },
];

/**
 * Backend Product rows store specs as flat dicts (specifications,
 * technical_details, attributes) plus one product-level confidence_score —
 * there's no per-field confidence/agent/evidence/source-page the way the
 * pipeline demo mocks did. We fall back to the product's overall
 * confidence for every field and simply omit evidence/agent/source where
 * we don't have it — see the FieldRow guards above.
 */
function buildProductDna(product) {
  const conf = product.confidence_score != null ? Math.round(product.confidence_score * 100) : null;
  const toFields = (obj) =>
    Object.entries(obj || {}).map(([k, v]) =>
      field(
        k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        typeof v === "object" && v !== null ? JSON.stringify(v) : String(v),
        conf,
        null,
        null,
        null,
        null
      )
    );

  const technicalSpecs = [...toFields(product.specifications), ...toFields(product.technical_details), ...toFields(product.attributes)];

  const marketing = [];
  if (product.description) marketing.push(field("Description", product.description, conf, null, null, null, null));

  const seo = [];
  if (product.seo_title) seo.push(field("SEO Title", product.seo_title, conf, "seo", null, null, null));
  if (product.seo_description) seo.push(field("SEO Description", product.seo_description, conf, "seo", null, null, null));
  if (product.seo_keywords?.length) seo.push(field("Keywords", product.seo_keywords.join(", "), conf, "seo", null, null, null));

  const applications = (product.applications || []).map((a, i) => field(`Application ${i + 1}`, a, conf, "recommendation", null, null, null));

  const classification = [];
  if (product.category) classification.push(field("Category", product.category, conf, null, null, null, null));
  if (product.sku) classification.push(field("SKU", product.sku, conf, null, null, null, null));

  return {
    technicalSpecs,
    marketing,
    seo,
    applications,
    certifications: [], // not modeled on the backend yet
    compatibleProducts: [], // related_product_ids exist but aren't resolved to names by any endpoint yet
    replacementParts: [], // not modeled on the backend yet
    classification,
  };
}

function ProductDetail({ productId, back, notify }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    productsApi
      .get(productId)
      .then((p) => {
        if (cancelled) return;
        setProduct(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.detail || err?.message || "Couldn't load this product.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const dna = useMemo(() => (product ? buildProductDna(product) : null), [product]);
  const availableTabs = dna ? DNA_TABS.filter((t) => dna[t.id]?.length) : [];

  useEffect(() => {
    if (availableTabs.length && !availableTabs.find((t) => t.id === tab)) {
      setTab(availableTabs[0].id);
    }
  }, [availableTabs, tab]);

  const setStatus = async (status) => {
    if (!product) return;
    setSavingStatus(true);
    try {
      const updated = await productsApi.update(product.id, { status });
      setProduct(updated);
      notify?.(`Marked as ${STATUS_STYLE[status]?.label || status}.`);
    } catch (err) {
      notify?.(err?.detail || err?.message || "Couldn't update status.");
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <div>
        <button onClick={back} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to products
        </button>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div>
        <button onClick={back} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to products
        </button>
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p className="text-xs leading-relaxed text-rose-300">{error || "Product not found."}</p>
        </div>
      </div>
    );
  }

  const fields = dna[tab] || [];
  const statusStyle = STATUS_STYLE[product.status] || STATUS_STYLE.draft;

  return (
    <div>
      <button onClick={back} className="mb-4 flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300">
        <ChevronRight className="h-4 w-4 rotate-180" /> Back to products
      </button>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {product.category && <p className="mb-1 font-mono text-xs uppercase tracking-widest text-indigo-400">{product.category}</p>}
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{product.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill className={statusStyle.cls}>{statusStyle.label}</Pill>
            {product.sku && (
              <Pill className="border-zinc-800 bg-zinc-900 text-zinc-400">
                <FileStack className="h-3 w-3" /> {product.sku}
              </Pill>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {product.confidence_score != null && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">Overall confidence</p>
              <ConfidenceBadge value={Math.round(product.confidence_score * 100)} />
            </div>
          )}
          <Button
            variant="success"
            size="sm"
            loading={savingStatus}
            disabled={product.status === "approved"}
            onClick={() => setStatus("approved")}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exportApi
                .downloadProductJson(product.id, `${product.sku || product.id}.json`)
                .catch((err) => notify?.(err?.message || "Export failed."))
            }
          >
            Export record
          </Button>
        </div>
      </div>

      {availableTabs.length === 0 ? (
        <p className="text-sm text-zinc-600">No extracted fields yet for this product.</p>
      ) : (
        <>
          <div className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
            {availableTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${
                  tab === t.id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
                {tab === t.id && (
                  <motion.span layoutId="dna-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-indigo-500" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                )}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {fields.map((f) => (
              <FieldRow key={f.id} f={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Knowledge Graph (zoom / pan / hover / click to inspect)             */
/* ------------------------------------------------------------------ */

function KnowledgeGraphView() {
  const theme = useTheme();
  const edgeColor = theme === "light" ? "#d4d4d8" : "#3f3f46";
  const [active, setActive] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  const svgWrapRef = useRef(null);

  const [rawNodes, setRawNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const styleMapRef = useRef(new Map());

  const MAX_NODES = 60;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([knowledgeGraphApi.listNodes(), knowledgeGraphApi.listEdges()])
      .then(([nodesRes, edgesRes]) => {
        if (cancelled) return;
        setRawNodes(nodesRes || []);
        setEdges(edgesRes || []);
      })
      .catch((err) => !cancelled && setError(err?.detail || err?.message || "Couldn't load the knowledge graph."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = useMemo(() => {
    const trimmed = rawNodes.slice(0, MAX_NODES);
    return layoutNodes(trimmed.map((n) => ({ id: n.id, label: n.name, type: n.label })));
  }, [rawNodes]);

  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const visibleEdges = useMemo(
    () =>
      edges
        .filter((e) => visibleIds.has(e.source_node_id) && visibleIds.has(e.target_node_id))
        .map((e) => ({ from: e.source_node_id, to: e.target_node_id, label: e.relationship })),
    [edges, visibleIds]
  );

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const focusId = hovered || active;
  const activeNode = active ? nodeById[active] : null;
  const relatedEdges = active ? visibleEdges.filter((e) => e.from === active || e.to === active) : [];
  const legendTypes = useMemo(() => [...new Set(nodes.map((n) => n.type))], [nodes]);

  const onWheel = (e) => {
    setZoom((z) => Math.min(2.5, Math.max(0.6, z - e.deltaY * 0.001)));
  };

  const onPointerDown = (e) => {
    dragging.current = true;
    lastPoint.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPoint.current.x;
    const dy = e.clientY - lastPoint.current.y;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };
  const onPointerUp = () => { dragging.current = false; };

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div>
      <SectionHeading
        eyebrow="Graph"
        title="Interactive Knowledge Graph"
        description="Products, categories and applications, linked by the Knowledge Graph Agent. Scroll to zoom, drag to pan."
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p className="text-xs leading-relaxed text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-[460px] w-full rounded-xl" />
      ) : nodes.length === 0 ? (
        <p className="text-sm text-zinc-600">No graph data yet — process a document from the Pipeline view to populate the knowledge graph.</p>
      ) : (
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="relative overflow-hidden p-2">
          {rawNodes.length > MAX_NODES && (
            <p className="absolute left-3 top-3 z-10 rounded-md border border-zinc-800 bg-zinc-950/90 px-2 py-1 text-[11px] text-zinc-500 backdrop-blur">
              Showing {MAX_NODES} of {rawNodes.length} nodes
            </p>
          )}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-950/90 p-1 backdrop-blur">
            <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"><ZoomIn className="h-3.5 w-3.5" /></button>
            <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"><ZoomOut className="h-3.5 w-3.5" /></button>
            <button aria-label="Reset view" onClick={reset} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"><Maximize2 className="h-3.5 w-3.5" /></button>
          </div>
          <div
            ref={svgWrapRef}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="cursor-grab active:cursor-grabbing"
          >
            <svg viewBox="0 0 760 460" className="h-[460px] w-full select-none">
              <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "380px 230px", transition: dragging.current ? "none" : "transform 0.15s ease-out" }}>
                {visibleEdges.map((e, i) => {
                  const a = nodeById[e.from];
                  const b = nodeById[e.to];
                  if (!a || !b) return null;
                  const relatedToFocus = focusId && (e.from === focusId || e.to === focusId);
                  const dim = focusId && !relatedToFocus;
                  return (
                    <g key={i} opacity={dim ? 0.15 : 1}>
                      <line
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={relatedToFocus ? "#818cf8" : edgeColor}
                        strokeWidth={relatedToFocus ? 2 : 1.5}
                        strokeDasharray={relatedToFocus ? "4 3" : undefined}
                      >
                        {relatedToFocus && (
                          <animate attributeName="stroke-dashoffset" from="14" to="0" dur="0.6s" repeatCount="indefinite" />
                        )}
                      </line>
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" className="fill-zinc-600" fontSize="9" fontFamily="monospace">
                        {e.label}
                      </text>
                    </g>
                  );
                })}
                {nodes.map((n) => {
                  const style = styleForLabel(n.type, styleMapRef.current);
                  const isFocus = focusId === n.id;
                  const dim = focusId && !isFocus && !relatedEdges.some((e) => e.from === n.id || e.to === n.id) && !(hovered && visibleEdges.some((e) => (e.from === hovered && e.to === n.id) || (e.to === hovered && e.from === n.id)));
                  return (
                    <g
                      key={n.id}
                      opacity={dim ? 0.25 : 1}
                      onClick={() => setActive(n.id)}
                      onMouseEnter={() => setHovered(n.id)}
                      onMouseLeave={() => setHovered(null)}
                      className="cursor-pointer transition-opacity"
                    >
                      {isFocus && <circle cx={n.x} cy={n.y} r="20" fill={style.fill} opacity="0.15" />}
                      <circle cx={n.x} cy={n.y} r={isFocus ? 15 : 11} fill={style.fill} stroke={style.ring} strokeWidth="2" />
                      <text x={n.x} y={n.y + 28} textAnchor="middle" className="fill-zinc-300" fontSize="10.5">
                        {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Legend</p>
            <div className="space-y-2 text-sm">
              {legendTypes.map((type) => (
                <div key={type} className="flex items-center gap-2 text-zinc-400">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: styleForLabel(type, styleMapRef.current).fill }} />
                  <span>{type}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Node details</p>
            <AnimatePresence mode="wait">
              {activeNode ? (
                <motion.div key={activeNode.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <p className="text-sm font-medium text-zinc-100">{activeNode.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{activeNode.type}</p>
                  <div className="mt-3 space-y-1.5">
                    {relatedEdges.length === 0 && <p className="text-xs text-zinc-600">No connections in the loaded view.</p>}
                    {relatedEdges.map((e, i) => {
                      const otherId = e.from === active ? e.to : e.from;
                      const other = nodeById[otherId];
                      if (!other) return null;
                      return (
                        <p key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <GitBranch className="h-3 w-3 text-cyan-400" /> {e.label.replace(/_/g, " ")} &rarr; {other.label}
                        </p>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <p className="text-sm text-zinc-600">Click a node to inspect its relationships.</p>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Validation Queue (human-in-the-loop, side-by-side source preview)   */
/* ------------------------------------------------------------------ */

function SourcePreview({ item }) {
  if (!item) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <FileStack className="h-6 w-6 text-zinc-700" />
        <p className="text-xs text-zinc-600">Select a field to preview its source document.</p>
      </Card>
    );
  }
  const before = item.evidence.slice(0, Math.max(0, item.evidence.indexOf(item.value.split(" ")[0])));
  const s = confidenceStyle(item.confidence);
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-3">
        <FileText className="h-4 w-4 text-zinc-500" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-300">{item.sourceDoc}</p>
          <p className="text-[11px] text-zinc-600">Page {item.page}</p>
        </div>
      </div>
      <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-700">Extracted passage</p>
        <p className="text-sm leading-relaxed text-zinc-400">
          {before}
          <motion.mark
            initial={{ backgroundColor: "rgba(99,102,241,0)" }}
            animate={{ backgroundColor: "rgba(99,102,241,0.25)" }}
            transition={{ duration: 0.6 }}
            className="rounded px-0.5 text-zinc-100"
          >
            {item.evidence.slice(before.length)}
          </motion.mark>
        </p>
      </div>
      <div className={`mt-3 rounded-lg border px-3 py-2.5 ${s.bg} ${s.border}`}>
        <p className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
          <Gauge className="h-3.5 w-3.5" /> Confidence explanation
        </p>
        <p className="text-xs leading-relaxed text-zinc-400">
          {item.confidence < 75
            ? "This value was inferred rather than read directly from a single unambiguous source, so it carries lower confidence until a human confirms it."
            : "This value has moderate support but a conflicting or ambiguous alternative was found nearby in the source material."}
        </p>
      </div>
    </Card>
  );
}

function EvidencePanel({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    validationApi
      .getEvidence(productId)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && setError(err?.detail || err?.message || "Couldn't load evidence."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!productId) return null;

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-3">
        <FileText className="h-4 w-4 text-zinc-500" />
        <p className="truncate text-xs font-medium text-zinc-300">Agent reasoning</p>
      </div>
      {loading ? (
        <div className="space-y-2.5">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : !data?.agent_results?.length ? (
        <p className="text-sm text-zinc-600">No agent runs recorded for this product yet.</p>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto">
          {data.agent_results.map((r, i) => (
            <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <AgentChip agentId={r.agent_name} />
                {r.confidence != null && <ConfidenceBadge value={Math.round(r.confidence * 100)} compact />}
              </div>
              {r.output && (
                <p className="truncate text-xs text-zinc-500">
                  {typeof r.output === "string" ? r.output : JSON.stringify(r.output)}
                </p>
              )}
              {r.latency_ms != null && <p className="mt-1 text-[10px] text-zinc-700">{r.latency_ms}ms</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ValidationQueueView() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [justResolved, setJustResolved] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    validationApi
      .getQueue()
      .then((res) => {
        setItems(res);
        setSelectedId((prev) => prev || res[0]?.id || null);
      })
      .catch((err) => setError(err?.detail || err?.message || "Couldn't load the review queue."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const removeResolved = (id) => {
    setJustResolved(id);
    setTimeout(() => {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id);
        setSelectedId((sel) => (sel === id ? next[0]?.id || null : sel));
        return next;
      });
      setJustResolved(null);
    }, 420);
    setTimeout(() => setToast(null), 3000);
  };

  const approve = async (product) => {
    setBusyId(product.id);
    try {
      await validationApi.approve(product.id);
      setToast(`Approved '${product.name}'.`);
      removeResolved(product.id);
    } catch (err) {
      setToast(err?.detail || err?.message || "Couldn't approve — you may not have reviewer permissions.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (product) => {
    const reason = rejectReason.trim();
    if (!reason) return;
    setBusyId(product.id);
    try {
      await validationApi.reject(product.id, reason);
      setToast(`Rejected '${product.name}'.`);
      setRejectingId(null);
      setRejectReason("");
      removeResolved(product.id);
    } catch (err) {
      setToast(err?.detail || err?.message || "Couldn't reject — you may not have reviewer permissions.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SectionHeading
        eyebrow="Human-in-the-loop"
        title="Validation Queue"
        description="Products awaiting human review sit here until an approve or reject decision is made. Approve/reject require Reviewer or Admin — use Settings to switch role in dev."
      />

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-4 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm text-indigo-300">
            <CheckCircle2 className="h-4 w-4" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p className="text-xs leading-relaxed text-rose-300">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Queue clear" description="Every flagged product has a human decision. Nice work." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <AnimatePresence>
              {items.map((p) => {
                const isSelected = selectedId === p.id;
                const isRejecting = rejectingId === p.id;
                const conf = p.confidence_score != null ? Math.round(p.confidence_score * 100) : null;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1, scale: justResolved === p.id ? 1.01 : 1 }}
                    exit={{ opacity: 0, x: 24, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <Card interactive className={`relative cursor-pointer p-4 ${isSelected ? "border-indigo-500/50" : ""}`}>
                      {justResolved === p.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-zinc-950/80 backdrop-blur-sm"
                        >
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                          </motion.div>
                        </motion.div>
                      )}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-xs text-zinc-500">
                            {p.category || "Uncategorized"} <ChevronRight className="h-3 w-3" />
                          </p>
                          <p className="mt-0.5 text-sm text-zinc-100">{p.name}</p>
                          {p.sku && <p className="mt-1 text-[11px] text-zinc-600">SKU {p.sku}</p>}

                          {isRejecting && (
                            <input
                              autoFocus
                              value={rejectReason}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for rejection…"
                              className="mt-2 w-full max-w-sm rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-rose-500"
                            />
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {conf != null && <ConfidenceBadge value={conf} compact />}
                          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {isRejecting ? (
                              <>
                                <Button variant="danger" size="sm" icon={Check} loading={busyId === p.id} disabled={!rejectReason.trim()} onClick={() => reject(p)}>
                                  Confirm
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancel</Button>
                              </>
                            ) : (
                              <>
                                <Button variant="success" size="sm" icon={Check} loading={busyId === p.id} onClick={() => approve(p)}>Approve</Button>
                                <Button variant="danger" size="sm" icon={XCircle} onClick={() => { setRejectingId(p.id); setSelectedId(p.id); }}>Reject</Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <EvidencePanel productId={selectedId} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Copilot                                                          */
/* ------------------------------------------------------------------ */

function CopilotWelcome({ onPrompt }) {
  const pendingCount = flattenLowConfidence().length;
  const user = useUser();
  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.6)]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">Good to see you, {user.name || "there"}</h2>
        <p className="mt-1.5 text-sm text-zinc-500">Ask me about any field, product, or document — I'll answer with evidence, not guesses.</p>
      </motion.div>

      <div className="mt-8 grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <Card className="p-4 text-left">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400"><Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Today's insight</p>
          <p className="text-xs leading-relaxed text-zinc-400">{AI_INSIGHTS[0].text}</p>
        </Card>
        <Card className="p-4 text-left">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400"><ListChecks className="h-3.5 w-3.5 text-rose-400" /> Pending reviews</p>
          <p className="text-xs leading-relaxed text-zinc-400">{pendingCount} fields across {PRODUCTS.length} products are waiting in the validation queue.</p>
        </Card>
      </div>

      <div className="mt-6 w-full max-w-xl">
        <p className="mb-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">Quick prompts</p>
        <div className="flex flex-wrap gap-2">
          {COPILOT_PROMPTS.map((p) => (
            <button key={p} onClick={() => onPrompt(p)} className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-indigo-500/40 hover:text-indigo-300">
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CopilotView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text) => {
    const question = text.trim();
    if (!question || thinking) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setThinking(true);
    setError("");

    try {
      const result = await copilotApi.query(question);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: result.answer,
          sources: result.sources || [],
        },
      ]);
    } catch (err) {
      const message = err?.detail || err?.message || "Copilot could not answer right now.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I couldn't complete that request. Please check that the Copilot backend service is running and configured correctly.",
          error: true,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col">
      <SectionHeading
        eyebrow="Copilot"
        title={
          <span className="flex flex-wrap items-center gap-2">
            AI Copilot
            <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              Live · grounded
            </Pill>
          </span>
        }
        description="Ask questions about your catalog and uploaded documents. IntelliSpec sends the question to the backend, grounds the answer in available product/document context, and never exposes your API key to the browser."
      />

      <Card className="flex min-h-[520px] flex-1 flex-col overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-2xl">
              <CopilotWelcome onPrompt={send} />
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {COPILOT_PROMPTS.slice(0, 3).map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-left text-xs text-zinc-400 transition hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-300"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-5">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed sm:max-w-[80%] ${
                    m.role === "user"
                      ? "bg-indigo-500 text-white"
                      : m.error
                        ? "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : "border border-zinc-800 bg-zinc-900 text-zinc-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.sources?.length > 0 && (
                    <div className="mt-3 border-t border-zinc-800 pt-2">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.slice(0, 5).map((src) => (
                          <span
                            key={`${src.type}-${src.id}`}
                            className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-500"
                          >
                            {src.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
                  <span className="ml-2 text-xs text-zinc-500">Searching your context…</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {error && (
          <div className="mx-3 mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 sm:mx-4">
            {error}
          </div>
        )}

        <div className="border-t border-zinc-800 p-3 sm:p-4">
          {messages.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {COPILOT_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={thinking}
                  className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:border-indigo-500/40 hover:text-indigo-300 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about a field, product or document…"
              className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition-colors focus:border-indigo-500"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send Copilot question"
            >
              <Send className="h-4 w-4" />
            </motion.button>
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            Enter to send · Shift+Enter for a new line · Answers are grounded in available project context.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings modal (opened from Sidebar "Settings" and Profile menu)    */
/* ------------------------------------------------------------------ */

const SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Boxes },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: ShieldCheck },
];

/** Renders the ADMIN-only audit trail (approvals, rejections, logins — see Backend/app/api/v1/endpoints/audit.py). */
function AuditLogPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    auditApi
      .list()
      .then((res) => !cancelled && setLogs(res || []))
      .catch((err) => !cancelled && setError(err?.detail || err?.message || "Couldn't load audit logs."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
        <p className="text-xs leading-relaxed text-rose-300">{error}</p>
      </div>
    );
  }
  if (logs.length === 0) {
    return <p className="text-sm text-zinc-600">No audit events yet.</p>;
  }
  return (
    <div className="space-y-2">
      {logs.map((l) => (
        <div key={l.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-2.5">
          <p className="text-sm text-zinc-200">{l.action}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
            {l.resource_type && <span>{l.resource_type}</span>}
            <span>{new Date(l.created_at).toLocaleString()}</span>
            {l.ip_address && <span>{l.ip_address}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-indigo-500" : "bg-zinc-700"}`}
    >
      <motion.span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
        animate={{ left: checked ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

function SettingsModal({ open, onClose, initialTab = "profile", notify }) {
  const user = useUser();
  const [tab, setTab] = useState(initialTab);
  const visibleTabs = user.role === "admin" ? [...SETTINGS_TABS, { id: "audit", label: "Audit Log", icon: FileStack }] : SETTINGS_TABS;
  const [prefs, setPrefs] = useState({
    emailDigest: true,
    validationAlerts: true,
    complianceAlerts: true,
    productUpdates: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) { setTab(initialTab); setSaved(false); }
  }, [open, initialTab]);

  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      notify?.("Settings saved.");
      setTimeout(() => onClose(), 500);
    }, 600);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="grid w-full max-w-2xl grid-cols-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 sm:grid-cols-[160px_1fr]"
          >
            <div className="border-b border-zinc-800 bg-zinc-900/40 p-3 sm:border-b-0 sm:border-r">
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Settings</p>
              <div className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
                {visibleTabs.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        active ? "bg-indigo-500/10 text-indigo-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex max-h-[70vh] flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
                <p className="text-sm font-medium text-zinc-200">{visibleTabs.find((t) => t.id === tab)?.label}</p>
                <button onClick={onClose} aria-label="Close settings" className="rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {tab === "profile" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 font-mono text-lg text-zinc-300 ring-1 ring-zinc-700">
                        {(user.name || "U").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{user.name || "User"}</p>
                        <p className="text-xs text-zinc-500">{user.role || "Catalog Manager"} · {user.company || "—"}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                        <p className="text-[11px] text-zinc-500">Member since</p>
                        <p className="mt-0.5 text-sm text-zinc-200">
                          {user.joinedAt ? new Date(user.joinedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5">
                        <p className="text-[11px] text-zinc-500">Signed in via</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-zinc-200">
                          {user.via === "signup" ? <UserPlus className="h-3.5 w-3.5 text-indigo-400" /> : <LogIn className="h-3.5 w-3.5 text-indigo-400" />}
                          {user.via === "signup" ? "New registration" : "Existing account"}
                        </p>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">Full name</span>
                      <input key={user.name} defaultValue={user.name} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">Email</span>
                      <input key={user.email} defaultValue={user.email} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">Company / workspace</span>
                      <input key={user.company} defaultValue={user.company} className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">
                        Role <span className="text-zinc-700">(dev only — controls Validation Queue approve/reject access)</span>
                      </span>
                      <select
                        value={user.role || "analyst"}
                        onChange={async (e) => {
                          const role = e.target.value;
                          try {
                            const updated = await authApi.devSetRole(role);
                            user.updateRole?.(updated.role);
                            notify?.(`Role switched to ${updated.role}.`);
                          } catch (err) {
                            notify?.(err?.detail || err?.message || "Couldn't switch role.");
                          }
                        }}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                      >
                        <option value="analyst">Analyst</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </label>
                  </div>
                )}

                {tab === "workspace" && (
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-500">Workspace name</span>
                      <input defaultValue="TerraDyne Industrial" className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" />
                    </label>
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-3">
                      <div>
                        <p className="text-sm text-zinc-200">Plan</p>
                        <p className="text-xs text-zinc-500">Enterprise · unlimited catalog uploads</p>
                      </div>
                      <Pill className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300">Active</Pill>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-3">
                      <div>
                        <p className="text-sm text-zinc-200">Confidence review threshold</p>
                        <p className="text-xs text-zinc-500">Fields below this score enter the Validation Queue</p>
                      </div>
                      <span className="font-mono text-sm text-zinc-300">80%</span>
                    </div>
                  </div>
                )}

                {tab === "notifications" && (
                  <div className="space-y-1">
                    {[
                      { key: "emailDigest", label: "Daily email digest", desc: "A summary of pipeline activity each morning" },
                      { key: "validationAlerts", label: "Validation queue alerts", desc: "Notify when fields drop below the confidence threshold" },
                      { key: "complianceAlerts", label: "Compliance flags", desc: "Notify immediately on certification or regulatory flags" },
                      { key: "productUpdates", label: "Product announcements", desc: "Occasional updates about new Catalyst features" },
                    ].map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-4 border-b border-zinc-900 py-3 last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200">{row.label}</p>
                          <p className="text-xs text-zinc-500">{row.desc}</p>
                        </div>
                        <Toggle
                          checked={prefs[row.key]}
                          onChange={(v) => setPrefs((p) => ({ ...p, [row.key]: v }))}
                          label={row.label}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {tab === "security" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <div>
                          <p className="text-sm text-zinc-200">Two-factor authentication</p>
                          <p className="text-xs text-zinc-500">Enabled via authenticator app</p>
                        </div>
                      </div>
                      <Pill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">On</Pill>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Link2 className="h-4 w-4 text-zinc-400" />
                        <div>
                          <p className="text-sm text-zinc-200">SSO (SAML 2.0)</p>
                          <p className="text-xs text-zinc-500">Not connected</p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => notify?.("SSO setup would open your identity provider flow here.")}>Connect</Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-3">
                      <div>
                        <p className="text-sm text-zinc-200">Active sessions</p>
                        <p className="text-xs text-zinc-500">1 device currently signed in</p>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => notify?.("All other sessions would be revoked here.")}>Revoke others</Button>
                    </div>
                  </div>
                )}

                {tab === "audit" && <AuditLogPanel />}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3.5">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" icon={Check} loading={saving} success={saved} onClick={save}>Save changes</Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Fixed-position toast stack for app-wide, non-blocking confirmations
 * (settings saved, workspace switched, etc.) — separate from the local
 * toasts already used inside the Validation Queue. */
function GlobalToast({ toast }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex max-w-xs items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 shadow-2xl shadow-black/50"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Welcome / feature overview (shown once, right after login)          */
/* ------------------------------------------------------------------ */

const FEATURE_OVERVIEW = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    accent: "text-indigo-400",
    bg: "from-indigo-500/15 to-indigo-500/0",
    title: "Dashboard",
    desc: "Live KPIs, confidence distribution, agent status, and AI-generated insights across your whole catalog at a glance.",
  },
  {
    id: "pipeline",
    icon: Zap,
    accent: "text-emerald-400",
    bg: "from-emerald-500/15 to-emerald-500/0",
    title: "Live Pipeline",
    desc: "Feed in a PDF, a URL, an image link, or just a few lines of text. Watch 9 AI agents fuse, validate and score every field in real time.",
  },
  {
    id: "products",
    icon: Package,
    accent: "text-cyan-400",
    bg: "from-cyan-500/15 to-cyan-500/0",
    title: "Products & Product DNA",
    desc: "Every SKU broken into explainable fields — specs, SEO, certifications — each tagged with a source document, page, and confidence score.",
  },
  {
    id: "graph",
    icon: Share2,
    accent: "text-pink-400",
    bg: "from-pink-500/15 to-pink-500/0",
    title: "Knowledge Graph",
    desc: "Products, components, standards and documents linked automatically. Zoom, pan, and click any node to inspect its relationships.",
  },
  {
    id: "validation",
    icon: ListChecks,
    accent: "text-amber-400",
    bg: "from-amber-500/15 to-amber-500/0",
    title: "Validation Queue",
    desc: "Low-confidence and conflicting fields wait here for a human decision, with the exact source passage highlighted side-by-side.",
  },
  {
    id: "copilot",
    icon: MessageSquare,
    accent: "text-violet-400",
    bg: "from-violet-500/15 to-violet-500/0",
    title: "AI Copilot",
    desc: "Ask why a field is low-confidence, compare two products, or generate a catalog quality report — grounded in evidence, not guesses.",
  },
];

const CAPABILITY_BADGES = [
  { icon: Boxes, label: "Multi-source fusion" },
  { icon: FileStack, label: "Evidence-traced fields" },
  { icon: ShieldCheck, label: "Human-in-the-loop" },
  { icon: GitBranch, label: "Conflict detection" },
];

function WelcomeView({ onEnter }) {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center sm:mb-10">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_10px_30px_-8px_rgba(99,102,241,0.6)] sm:h-14 sm:w-14">
            <Sparkles className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <p className="mb-2 flex items-center justify-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-indigo-400">
            <span className="h-1 w-1 rounded-full bg-indigo-400" /> Welcome to Catalyst
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl md:text-3xl">AI-Powered Product Intelligence</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Turn scattered documents, URLs, and notes into a trustworthy, explainable product catalog.
            Every value your agents produce carries its source, its confidence, and a human sign-off when it matters.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {CAPABILITY_BADGES.map((b) => (
              <Pill key={b.label} className="border-zinc-800 bg-zinc-900 text-zinc-400">
                <b.icon className="h-3 w-3" /> {b.label}
              </Pill>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_OVERVIEW.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => onEnter(f.id)}
                className="text-left"
              >
                <Card interactive className="h-full p-5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br ${f.bg} ring-1 ring-inset ring-white/5`}>
                    <Icon className={`h-5 w-5 ${f.accent}`} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-zinc-100">{f.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{f.desc}</p>
                  <span className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-400">
                    Explore <ArrowRight className="h-3 w-3" />
                  </span>
                </Card>
              </motion.button>
            );
          })}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-10 flex justify-center">
          <Button variant="primary" size="md" icon={Sparkles} onClick={() => onEnter("dashboard")} className="px-6 py-2.5 text-sm">
            Enter Catalyst
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth gate (Sign in / Register) — main app is unreachable without it */
/* ------------------------------------------------------------------ */

function AuthView({ mode, setMode, onAuthenticated, onBack, notify }) {
  const isSignup = mode === "signup";
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  // After a successful /register, the account still needs OTP verification
  // before it can sign in. Since no email/SMS provider is wired up yet,
  // the backend hands the code back directly in dev mode (dev_otp_code) —
  // this step just asks the user to confirm it. Swap this UI copy out once
  // real OTP delivery exists.
  const [otpStage, setOtpStage] = useState(null); // null | { email, devCode }
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    setErrors({});
    setAttempted(false);
    setApiError("");
    setOtpStage(null);
    setOtpCode("");
  }, [mode]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (isSignup && !form.name.trim()) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    if (isSignup && form.confirm !== form.password) next.confirm = "Passwords don't match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const completeSignIn = async (email, password, fallbackName) => {
    const tokens = await authApi.login({ email, password });
    tokenStore.set(tokens);
    const me = await authApi.me();
    onAuthenticated({
      name: me.full_name || fallbackName,
      email: me.email,
      company: form.company.trim() || "TerraDyne Industrial",
      role: me.role || "Catalog Manager",
      joinedAt: new Date(),
      via: isSignup ? "signup" : "signin",
    });
    notify?.(isSignup ? `Account created — welcome, ${me.full_name || fallbackName}.` : `Welcome back, ${me.full_name || fallbackName}.`);
  };

  const submit = async (e) => {
    e.preventDefault();
    setApiError("");
    setAttempted(true);
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (isSignup) {
        const res = await authApi.register({
          email: form.email.trim(),
          password: form.password,
          full_name: form.name.trim(),
        });
        if (res.dev_otp_code) {
          // Dev fallback: no real OTP delivery yet, so we already have the
          // code — skip straight to verifying instead of showing a step.
          await authApi.verifyOtp({ email: form.email.trim(), otp_code: res.dev_otp_code });
          await completeSignIn(form.email.trim(), form.password, form.name.trim());
        } else {
          // Real delivery path (once an email/SMS provider exists): ask
          // the user to enter the code they were sent.
          setOtpStage({ email: form.email.trim() });
        }
      } else {
        await completeSignIn(form.email.trim(), form.password);
      }
    } catch (err) {
      setApiError(err?.detail || err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    if (!otpStage) return;
    setApiError("");
    setSubmitting(true);
    try {
      await authApi.verifyOtp({ email: otpStage.email, otp_code: otpCode.trim() });
      await completeSignIn(otpStage.email, form.password, form.name.trim());
    } catch (err) {
      setApiError(err?.detail || err?.message || "Invalid or expired code.");
    } finally {
      setSubmitting(false);
    }
  };

  if (otpStage) {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-zinc-950 px-4 py-8 text-zinc-100 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-sm">
          <button onClick={() => setOtpStage(null)} className="mb-6 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
          </button>
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Verify your email</h1>
            <p className="mt-1 text-xs text-zinc-500">Enter the 6-digit code sent to {otpStage.email}</p>
          </div>
          <Card className="p-5">
            {apiError && (
              <div className="mb-3.5 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-xs leading-relaxed text-rose-300">{apiError}</p>
              </div>
            )}
            <form onSubmit={submitOtp} className="space-y-3.5">
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-lg tracking-[0.3em] text-zinc-100 outline-none focus:border-indigo-500"
              />
              <Button type="submit" variant="primary" className="w-full justify-center" loading={submitting} icon={Check}>
                Verify & sign in
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const fieldClass = (key) =>
    `w-full rounded-lg border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors focus:border-indigo-500 ${
      attempted && errors[key] ? "border-rose-500/60" : "border-zinc-800"
    }`;

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-zinc-950 px-4 py-8 text-zinc-100 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-sm">
        <button onClick={onBack} className="mb-6 flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
        </button>

        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_8px_20px_-6px_rgba(99,102,241,0.6)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-xs text-zinc-500">{isSignup ? "Set up Catalyst for your team" : "Sign in to continue to Catalyst"}</p>
        </div>

        <Card className="p-5">
          <AnimatePresence>
            {attempted && errorCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="flex items-start gap-2 overflow-hidden rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-xs leading-relaxed text-rose-300">
                  {errorCount === 1 ? "Please fix the highlighted field below." : `Please fix ${errorCount} highlighted fields below.`}
                </p>
              </motion.div>
            )}
            {apiError && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="flex items-start gap-2 overflow-hidden rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-xs leading-relaxed text-rose-300">{apiError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={submit} noValidate className="space-y-3.5">
            {isSignup && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Full name</label>
                <input value={form.name} onChange={update("name")} placeholder="J. Alvarez" className={fieldClass("name")} />
                {attempted && errors.name && <p className="mt-1 text-[11px] text-rose-400">{errors.name}</p>}
              </div>
            )}
            {isSignup && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Company / workspace <span className="text-zinc-700">(optional)</span></label>
                <input value={form.company} onChange={update("company")} placeholder="TerraDyne Industrial" className={fieldClass("company")} />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  placeholder="you@company.com"
                  className={`${fieldClass("email")} pl-9`}
                />
              </div>
              {attempted && errors.email && <p className="mt-1 text-[11px] text-rose-400">{errors.email}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder="At least 8 characters"
                  className={`${fieldClass("password")} pl-9 pr-9`}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {attempted && errors.password && <p className="mt-1 text-[11px] text-rose-400">{errors.password}</p>}
            </div>
            {isSignup && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Confirm password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.confirm}
                  onChange={update("confirm")}
                  placeholder="Re-enter your password"
                  className={fieldClass("confirm")}
                />
                {attempted && errors.confirm && <p className="mt-1 text-[11px] text-rose-400">{errors.confirm}</p>}
              </div>
            )}

            {!isSignup && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 text-zinc-500">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900" /> Remember me
                </label>
                <button type="button" onClick={() => notify?.("Password reset link would be emailed to you.")} className="text-indigo-400 hover:text-indigo-300">
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full justify-center" loading={submitting} icon={isSignup ? UserPlus : LogIn}>
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-500">
          {isSignup ? "Already have an account?" : "New to Catalyst?"}{" "}
          <button onClick={() => setMode(isSignup ? "signin" : "signup")} className="font-medium text-indigo-400 hover:text-indigo-300">
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App shell                                                           */
/* ------------------------------------------------------------------ */

const VIEW_TITLES = {
  dashboard: "Dashboard",
  pipeline: "Live Pipeline",
  products: "Products",
  graph: "Knowledge Graph",
  validation: "Validation Queue",
  copilot: "AI Copilot",
};

export default function App() {
  // Single source of truth for which "screen" is visible. The main app
  // shell only ever renders when stage === "app" AND isAuthenticated is
  // true — both conditions are checked together at the return statement,
  // so there's no path that reaches the dashboard without a completed
  // (simulated) login.
  const [stage, setStage] = useState("welcome"); // "welcome" | "auth" | "app"
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup"
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({ name: "", email: "", company: "", role: "", joinedAt: null, via: null });
  const [pendingView, setPendingView] = useState("dashboard");

  const [view, setView] = useState("dashboard");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settings, setSettings] = useState({ open: false, tab: "profile" });
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = () => {
      productsApi
        .list({ status: "pending_review", page_size: 1 })
        .then((res) => !cancelled && setQueueCount(res.total ?? 0))
        .catch(() => {});
    };
    refresh();
    // Re-check periodically and whenever the Validation Queue view is left,
    // since approvals/rejections happen inside that view and there's no
    // global event bus to push the count update from there directly.
    // 60s (not 20s) because this is just a badge count, not pipeline
    // progress — pipeline progress stays on WebSocket (see watchJob) with
    // its own 60s polling fallback below.
    const t = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated, view]);

  const notify = useCallback((msg) => {
    setToast({ id: Date.now(), msg });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openSettings = useCallback((tab = "profile") => {
    setSettings({ open: true, tab });
  }, []);

  const openProduct = useCallback((id) => {
    if (!id) return;
    setSelectedProductId(id);
    setView("products");
  }, []);

  // Anything that wants to enter the app (a Welcome-page feature card, the
  // "Enter Catalyst" button) goes through this gate. Unauthenticated users
  // are redirected to Sign in / Register and land on their original
  // destination only after a successful (simulated) login.
  const requestEnter = useCallback((targetView = "dashboard") => {
    setPendingView(targetView);
    if (isAuthenticated) {
      setView(targetView);
      setStage("app");
    } else {
      setStage("auth");
    }
  }, [isAuthenticated]);

  const handleAuthenticated = useCallback((identity) => {
    setUser(identity);
    setIsAuthenticated(true);
    setView(pendingView);
    setStage("app");
  }, [pendingView]);

  const signOut = useCallback(() => {
    setIsAuthenticated(false);
    setUser({ name: "", email: "", company: "", role: "", joinedAt: null, via: null });
    setStage("welcome");
    setAuthMode("signin");
    notify("Signed out.");
  }, [notify]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  let content;
  if (view === "dashboard") content = <Dashboard setView={setView} openProduct={openProduct} />;
  else if (view === "pipeline") content = <PipelineView openProduct={openProduct} />;
  else if (view === "products")
    content = selectedProductId ? (
      <ProductDetail productId={selectedProductId} back={() => setSelectedProductId(null)} notify={notify} />
    ) : (
      <ProductsList openProduct={openProduct} />
    );
  else if (view === "graph") content = <KnowledgeGraphView />;
  else if (view === "validation") content = <ValidationQueueView />;
  else if (view === "copilot") content = <CopilotView />;

  const authorizedApp = stage === "app" && isAuthenticated;

  return (
    <ThemeContext.Provider value={theme}>
      <UserContext.Provider value={{ ...user, updateRole: (role) => setUser((u) => ({ ...u, role })) }}>
        <ThemeStyleOverrides />
        {authorizedApp ? (
      <div className={`flex h-screen w-full bg-zinc-950 text-zinc-100 ${theme === "light" ? "theme-light [color-scheme:light]" : "[color-scheme:dark]"}`}>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setView} onOpenProduct={openProduct} />
        <SettingsModal open={settings.open} initialTab={settings.tab} onClose={() => setSettings((s) => ({ ...s, open: false }))} notify={notify} />
        <GlobalToast toast={toast} />

        <Sidebar
          view={view}
          setView={(v) => {
            setSelectedProductId(null);
            setView(v);
          }}
          queueCount={queueCount}
          onOpenSettings={() => openSettings("profile")}
          onGoHome={() => setStage("welcome")}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            onOpenPalette={() => setPaletteOpen(true)}
            notify={notify}
            onOpenSettings={openSettings}
            onViewAllActivity={() => { setSelectedProductId(null); setView("dashboard"); }}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            onSignOut={signOut}
          />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={view + (selectedProductId || "")}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {content}
              </motion.div>
            </AnimatePresence>
          </main>
          <nav className="flex items-center justify-around border-t border-zinc-800 bg-zinc-950 py-2 md:hidden">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedProductId(null);
                    setView(item.id);
                  }}
                  className={`flex flex-col items-center gap-1 px-2 py-1 text-[10px] ${view === item.id ? "text-indigo-400" : "text-zinc-500"}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  {item.label.split(" ")[0]}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
        ) : stage === "auth" ? (
          <AuthView
            mode={authMode}
            setMode={setAuthMode}
            onAuthenticated={handleAuthenticated}
            onBack={() => setStage("welcome")}
            notify={notify}
          />
        ) : (
          <WelcomeView onEnter={requestEnter} />
        )}
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}