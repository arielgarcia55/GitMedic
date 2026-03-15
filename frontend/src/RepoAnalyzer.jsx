import { useState, useRef, useEffect } from "react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from "recharts"


// ─────────────────────────────────────────────
// Config — swap these for your real endpoints
// ─────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE

const ENDPOINTS = {
  commitActivity: `${API_BASE}/commit-activity`,
  healthScore:    `${API_BASE}/health-score`,
  riskDetection:  `${API_BASE}/risk-detection`,
}

// ─────────────────────────────────────────────
// Mock data generators — remove when Lambda is ready
// ─────────────────────────────────────────────
function mockCommitActivity(repoName) {
  const heatmap = {}
  const end   = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  start.setDate(start.getDate() + 1)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0]
    const wd  = d.getDay()
    const base = wd === 0 || wd === 6 ? 0.55 : 0.62
    heatmap[key] = Math.random() > base ? Math.floor(Math.random() * 12) + 1 : 0
  }
  const dates = Object.keys(heatmap).sort()
  const rolling = []
  dates.forEach((date, i) => {
    if (i < 30) return
    const count = dates.slice(i - 30, i).reduce((s, d) => s + heatmap[d], 0)
    if (i % 2 === 0) rolling.push({ date: date.slice(5), rollingCount: count })
  })
  const recent = dates.slice(-30).reduce((s, d) => s + heatmap[d], 0)
  const prev   = dates.slice(-60, -30).reduce((s, d) => s + heatmap[d], 0)
  const pct    = prev === 0 ? 100 : Math.round(((recent - prev) / prev) * 100)
  const trend  = pct > 20 ? "increasing" : pct < -20 ? "declining" : "stable"
  const total  = Object.values(heatmap).reduce((s, v) => s + v, 0)
  const active = Object.values(heatmap).filter(v => v > 0).length
  return {
    totalCommits: total,
    activeDays: active,
    heatmap,
    rollingActivity: rolling,
    trendSummary: { trend, recentCommits: recent, previousCommits: prev, percentChange: pct }
  }
}
 
function scoreToGrade(score) {
  if (score >= 90) return "A+"
  if (score >= 80) return "A"
  if (score >= 77) return "A-"
  if (score >= 73) return "B+"
  if (score >= 70) return "B"
  if (score >= 67) return "B-"
  if (score >= 63) return "C+"
  if (score >= 60) return "C"
  if (score >= 57) return "C-"
  if (score >= 50) return "D"
  return "F"
}
 
function gradeColor(grade) {
  if (grade.startsWith("A")) return "#39d353"
  if (grade.startsWith("B")) return "#58a6ff"
  if (grade.startsWith("C")) return "#d29922"
  return "#f85149"
}
 
function generateAdvice(signals) {
  const weak = signals.filter(s => s.score < 65).map(s => s.name.toLowerCase())
  if (weak.length === 0) return "This repo is in great shape. Keep up the consistent activity and engagement."
  const listed = weak.length === 1
    ? weak[0]
    : weak.slice(0, -1).join(", ") + ", and " + weak[weak.length - 1]
  return `Based on ${listed}, contributors on this repo should focus on improving these areas to raise the overall health score.`
}
 
function mockHealthScore(repoName) {
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const signals = [
    { name: "Commit frequency",      score: rand(55, 95) },
    { name: "Issue backlog",         score: rand(40, 90) },
    { name: "Contributor diversity", score: rand(35, 85) },
    { name: "PR open/close ratio",   score: rand(50, 95) },
    { name: "PR turnaround",         score: rand(45, 88) },
  ]
  const overall = Math.round(signals.reduce((s, x) => s + x.score, 0) / signals.length)
  const grade   = scoreToGrade(overall)
  const advice  = generateAdvice(signals)
  return { overall, grade, signals, advice }
}
 
function mockRiskDetection(repoName) {
  return {
    risks: [
      {
        type: "Bus Factor",
        severity: "high",
        detail: "74% of commits come from a single contributor.",
        metric: "1 key contributor",
      },
      {
        type: "Stale Branches",
        severity: "medium",
        detail: "6 branches have not been updated in over 30 days.",
        metric: "6 stale branches",
      },
      {
        type: "Unreviewed PRs",
        severity: "medium",
        detail: "4 open PRs have been waiting over 2 weeks for review.",
        metric: "4 open PRs",
      },
      {
        type: "Contributor Dropout",
        severity: "low",
        detail: "2 previously active contributors have gone quiet in the last 60 days.",
        metric: "2 inactive",
      },
    ]
  }
}
 
// ─────────────────────────────────────────────
// Heatmap
// ─────────────────────────────────────────────
function heatColor(n) {
  if (!n)     return "#21262d"
  if (n < 3)  return "#0e4429"
  if (n < 6)  return "#006d32"
  if (n < 10) return "#26a641"
  return "#39d353"
}
 
function CommitHeatmap({ heatmap }) {
  const months    = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const dayLabels = ["","M","","W","","F",""]
 
  // Derive range from actual data — always shows full 52 weeks
  const allDates = Object.keys(heatmap).sort()
  const end      = allDates.length ? new Date(allDates[allDates.length - 1]) : new Date()
  const start    = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  start.setDate(start.getDate() + 1)
 
  const padStart = new Date(start)
  padStart.setDate(padStart.getDate() - padStart.getDay())
 
  const weeks = []
  let cur = new Date(padStart), week = []
  while (cur <= end || week.length > 0) {
    const key     = cur.toISOString().split("T")[0]
    const inRange = cur >= start && cur <= end
    week.push({ date: key, count: inRange ? (heatmap[key] || 0) : null, month: cur.getMonth(), dom: cur.getDate() })
    if (week.length === 7) { weeks.push(week); week = [] }
    cur.setDate(cur.getDate() + 1)
    if (cur > end && week.length === 0) break
    if (cur > new Date(end.getTime() + 7 * 86400000)) break
  }
  if (week.length) {
    while (week.length < 7) week.push({ date: "", count: null, month: 0, dom: 0 })
    weeks.push(week)
  }
 
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 20, marginRight: 4 }}>
          {dayLabels.map((d, i) => (
            <div key={i} style={{ height: 13, fontSize: 10, color: "#8b949e", lineHeight: "13px", width: 18, textAlign: "right" }}>{d}</div>
          ))}
        </div>
        <div>
          <div style={{ display: "flex", gap: 3, marginBottom: 3, height: 18 }}>
            {weeks.map((wk, wi) => {
              const first = wk.find(d => d.dom === 1 && d.count !== null)
              return <div key={wi} style={{ width: 13, fontSize: 10, color: "#8b949e" }}>{first ? months[first.month] : ""}</div>
            })}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {weeks.map((wk, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {wk.map((day, di) =>
                  day.count === null
                    ? <div key={di} style={{ width: 13, height: 13 }} />
                    : <div key={di} title={`${day.date}: ${day.count} commit${day.count !== 1 ? "s" : ""}`}
                        style={{ width: 13, height: 13, borderRadius: 2, background: heatColor(day.count), cursor: "default" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 10, color: "#8b949e" }}>Less</span>
        {[0, 1, 3, 6, 10].map(v => (
          <div key={v} style={{ width: 11, height: 11, borderRadius: 2, background: heatColor(v) }} />
        ))}
        <span style={{ fontSize: 10, color: "#8b949e" }}>More</span>
      </div>
    </div>
  )
}
 
// ─────────────────────────────────────────────
// Metric card
// ─────────────────────────────────────────────
function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "12px 16px" }}>
      <p style={{ fontSize: 11, color: "#8b949e", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 600, margin: 0, fontFamily: "monospace", color: color || "#e6edf3" }}>{value}</p>
    </div>
  )
}
 
// ─────────────────────────────────────────────
// Trend badge
// ─────────────────────────────────────────────
function TrendBadge({ trend, pct }) {
  const map = {
    increasing: { bg: "#0e4429", color: "#39d353", label: `↑ Up ${pct}%` },
    declining:  { bg: "#4c1b1b", color: "#f85149", label: `↓ Down ${Math.abs(pct)}%` },
    stable:     { bg: "#1c2128", color: "#8b949e", label: "→ Stable" },
  }
  const c = map[trend] || map.stable
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, fontFamily: "monospace" }}>
      {c.label}
    </span>
  )
}
 
// ─────────────────────────────────────────────
// Section card wrapper
// ─────────────────────────────────────────────
function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "18px 22px", marginBottom: 14 }}>
      {title && <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 4px", color: "#e6edf3" }}>{title}</p>}
      {subtitle && <p style={{ fontSize: 12, color: "#8b949e", margin: "0 0 14px" }}>{subtitle}</p>}
      {children}
    </div>
  )
}
 
// ─────────────────────────────────────────────
// Commit Activity view
// ─────────────────────────────────────────────
function CommitActivityView({ data }) {
  const { trendSummary: ts } = data
  const pctColor = ts.percentChange > 0 ? "#39d353" : ts.percentChange < 0 ? "#f85149" : "#8b949e"
  const pctStr   = (ts.percentChange > 0 ? "+" : "") + ts.percentChange + "%"
 
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <MetricCard label="Total commits"      value={data.totalCommits} />
        <MetricCard label="Active days"         value={data.activeDays} />
        <MetricCard label="Recent 30d"          value={ts.recentCommits} />
        <MetricCard label="vs prev 30d"         value={pctStr} color={pctColor} />
      </div>
 
      <SectionCard title="Commit heatmap — last 12 months">
        <CommitHeatmap heatmap={data.heatmap} />
      </SectionCard>
 
      <SectionCard title="Rolling 30-day activity" subtitle="Commit count in trailing 30 days, sampled every 2 days">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.rollingActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "monospace" }} tickLine={false} axisLine={{ stroke: "#30363d" }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6, fontSize: 12, fontFamily: "monospace" }}
              labelStyle={{ color: "#8b949e" }} itemStyle={{ color: "#39d353" }}
              formatter={v => [`${v} commits`]}
            />
            <Line type="monotone" dataKey="rollingCount" stroke="#39d353" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
 
      <div style={{ background: "#161b22", border: `1px solid ${ts.trend === "increasing" ? "#0e4429" : ts.trend === "declining" ? "#4c1b1b" : "#30363d"}`, borderRadius: 8, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <TrendBadge trend={ts.trend} pct={ts.percentChange} />
        <span style={{ fontSize: 13, color: "#8b949e" }}>
          {ts.trend === "increasing"
            ? `Activity trending up — ${ts.recentCommits} commits in the last 30 days vs ${ts.previousCommits} previously.`
            : ts.trend === "declining"
            ? `Activity trending down — ${ts.recentCommits} commits in the last 30 days vs ${ts.previousCommits} previously.`
            : `Activity is stable — ${ts.recentCommits} commits in the last 30 days vs ${ts.previousCommits} previously.`}
        </span>
      </div>
    </div>
  )
}
 
// ─────────────────────────────────────────────
// Health Score view
// ─────────────────────────────────────────────
function HealthScoreView({ data }) {
  // Normalize Lambda response shape vs mock shape
  const grade   = data.overall?.grade || data.grade || scoreToGrade(data.overall)
  const wscore  = data.overall?.weighted_score
  const overall = wscore != null ? Math.round(wscore * 100) : data.overall
  const signals = (data.sub_scores || data.signals || []).map(s => ({
    name:  s.displayName || s.name,
    score: s.score <= 1 ? Math.round(s.score * 100) : s.score,
    note:  s.note,
    label: s.label,
  }))
  const gColor  = gradeColor(grade)
  const advice  = data.advice || generateAdvice(signals)
 
  return (
    <div>
      {/* Big overall grade */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0 24px", marginBottom: 14, background: "#161b22", border: "1px solid #30363d", borderRadius: 8 }}>
        <p style={{ fontSize: 11, color: "#8b949e", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".8px" }}>Health Score</p>
        <div style={{
          width: 96, height: 96, borderRadius: 16,
          border: `2px solid ${gColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0d1117", marginBottom: 10,
          boxShadow: `0 0 24px ${gColor}22`
        }}>
          <span style={{ fontSize: 42, fontWeight: 700, color: gColor, fontFamily: "monospace", letterSpacing: "-2px" }}>{grade}</span>
        </div>
        <p style={{ fontSize: 12, color: "#8b949e", margin: 0, fontFamily: "monospace" }}>{overall}/100</p>
      </div>
 
      {/* Subscore cards */}
      <SectionCard title="Subscores">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {signals.map((s, i) => {
            const sg    = scoreToGrade(s.score)
            const sgCol = gradeColor(sg)
            return (
              <div key={i} title={s.note || ""} style={{
                background: "#0d1117", border: `1px solid #30363d`,
                borderRadius: 8, padding: "14px 12px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                cursor: s.note ? "help" : "default"
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 10,
                  border: `1.5px solid ${sgCol}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#161b22"
                }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: sgCol, fontFamily: "monospace" }}>{sg}</span>
                </div>
                <p style={{ fontSize: 11, color: "#8b949e", margin: 0, textAlign: "center", lineHeight: 1.4 }}>{s.name}</p>
                {s.label && <span style={{ fontSize: 10, color: sgCol, fontFamily: "monospace", textAlign: "center" }}>{s.label}</span>}
              </div>
            )
          })}
        </div>
      </SectionCard>
 
      {/* Advice */}
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "16px 20px" }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "#8b949e", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".6px" }}>Advice</p>
        <p style={{ fontSize: 13, color: "#c9d1d9", margin: 0, lineHeight: 1.6 }}>{advice}</p>
      </div>
    </div>
  )
}
 
// ─────────────────────────────────────────────
// Risk Detection view
// ─────────────────────────────────────────────
function RiskDetectionView({ data }) {
  const sevConfig = {
    high:   { bg: "#4c1b1b", color: "#f85149", border: "#6e2323", label: "High" },
    medium: { bg: "#2d1d00", color: "#d29922", border: "#5a3a00", label: "Medium" },
    low:    { bg: "#0d2119", color: "#3fb950", border: "#1b4332", label: "Low" },
  }
 
  const counts = { high: 0, medium: 0, low: 0 }
  data.risks.forEach(r => counts[r.severity]++)
 
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        <MetricCard label="High severity"   value={counts.high}   color="#f85149" />
        <MetricCard label="Medium severity" value={counts.medium} color="#d29922" />
        <MetricCard label="Low severity"    value={counts.low}    color="#3fb950" />
      </div>
 
      {data.risks.map((risk, i) => {
        const c = sevConfig[risk.severity]
        return (
          <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "14px 18px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#e6edf3" }}>{risk.type}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: c.color }}>{risk.metric}</span>
                <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}`, fontSize: 11, padding: "1px 8px", borderRadius: 20 }}>
                  {c.label}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#8b949e", margin: 0 }}>{risk.detail}</p>
          </div>
        )
      })}
    </div>
  )
}
 
// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
const ANALYSES = [
  { key: "commitActivity", label: "Commit Activity",  desc: "Heatmap, rolling activity, and trend summary" },
  { key: "healthScore",    label: "Repo Health Score", desc: "Composite score across key health signals" },
  { key: "riskDetection",  label: "Risk Detection",    desc: "Bus factor, stale branches, and contributor risk" },
]
 
const USE_MOCK = false // Set to false once your Lambdas are live
 
export default function RepoAnalyzer() {
  const [repoUrl,   setRepoUrl]   = useState("")
  const [active,    setActive]    = useState(null)
  const [results,   setResults]   = useState({})
  const [loading,   setLoading]   = useState(null)
  const [error,     setError]     = useState(null)
  const resultsRef = useRef(null)
 
  const extractRepo = (url) => {
    const match = url.match(/github\.com\/([^/\s]+\/[^/\s]+)/)
    return match ? match[1].replace(/\.git$/, "") : url.trim()
  }
 
  const runAnalysis = async (key) => {
    if (!repoUrl.trim()) { setError("Please enter a GitHub repository URL first."); return }
    setError(null)
    setActive(key)
    setLoading(key)
 
    // Scroll to results
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
 
    try {
      let data
 
      if (USE_MOCK) {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 1400))
        const repoName = extractRepo(repoUrl)
        if (key === "commitActivity") data = mockCommitActivity(repoName)
        if (key === "healthScore")    data = mockHealthScore(repoName)
        if (key === "riskDetection")  data = mockRiskDetection(repoName)
      } else {
        // Real API calls — uncomment when Lambdas are ready
        const res = await fetch(`${ENDPOINTS[key]}?repo=${encodeURIComponent(repoUrl)}`)
        if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Request failed") }
        data = await res.json()
      }
 
      setResults(prev => ({ ...prev, [key]: data }))
    } catch (e) {
      setError(e.message)
      setActive(null)
    } finally {
      setLoading(null)
    }
  }
 
  const currentResult = active ? results[active] : null
 
  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: "32px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e6edf3" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
 
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 4px", letterSpacing: "-.3px" }}>Repo Analyzer</h1>
          <p style={{ fontSize: 13, color: "#8b949e", margin: 0 }}>Enter a GitHub repository to run analysis</p>
        </div>
 
        {/* Input */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && active) runAnalysis(active) }}
            placeholder="https://github.com/owner/repo"
            style={{
              flex: 1, background: "#0d1117", border: "1px solid #30363d",
              borderRadius: 6, padding: "10px 14px", color: "#c9d1d9",
              fontSize: 13, fontFamily: "monospace", outline: "none",
            }}
          />
        </div>
 
        {/* Analysis buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 28 }}>
          {ANALYSES.map(a => {
            const isActive  = active === a.key
            const isLoading = loading === a.key
            return (
              <button
                key={a.key}
                onClick={() => runAnalysis(a.key)}
                disabled={isLoading}
                className={`analysis-btn${isActive ? " analysis-btn-active" : ""}`}
                style={{
                  background:   isActive ? "#1f2937" : "#21262d",
                  border:       `1px solid ${isActive ? "#388bfd" : "rgba(240,246,255,0.1)"}`,
                  borderBottom: `1px solid ${isActive ? "#388bfd" : "rgba(240,246,255,0.15)"}`,
                  borderRadius: 6,
                  padding:      "10px 16px",
                  cursor:       isLoading ? "not-allowed" : "pointer",
                  textAlign:    "left",
                  transition:   "all .12s",
                  color:        "#e6edf3",
                  opacity:      isLoading ? 0.6 : 1,
                  boxShadow:    isActive
                    ? "inset 0 1px 0 rgba(56,139,253,0.1)"
                    : "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: isActive ? "#388bfd" : "#484f58",
                    flexShrink: 0,
                    boxShadow: isActive ? "0 0 0 2px rgba(56,139,253,0.25)" : "none",
                    transition: "all .12s",
                  }} />
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: isActive ? "#58a6ff" : "#c9d1d9" }}>
                    {isLoading ? "Running..." : a.label}
                  </p>
                </div>
                <p style={{ fontSize: 11, color: "#8b949e", margin: "0 0 0 16px" }}>{a.desc}</p>
              </button>
            )
          })}
        </div>
 
        {/* Error */}
        {error && (
          <div style={{ background: "#4c1b1b", border: "1px solid #6e2323", borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#f85149" }}>
            {error}
          </div>
        )}
 
        {/* Loading spinner */}
        {loading && (
          <div ref={resultsRef} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 40, textAlign: "center", marginBottom: 14 }}>
            <div style={{
              width: 28, height: 28, border: "2px solid #30363d",
              borderTop: "2px solid #39d353", borderRadius: "50%",
              animation: "spin .8s linear infinite", margin: "0 auto 12px",
            }} />
            <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 4px" }}>
              Running {ANALYSES.find(a => a.key === loading)?.label}...
            </p>
            <p style={{ color: "#484f58", fontSize: 11, margin: 0, fontFamily: "monospace" }}>
              {extractRepo(repoUrl)}
            </p>
          </div>
        )}
 
        {/* Results */}
        {!loading && currentResult && (
          <div ref={resultsRef}>
            {/* Result header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#58a6ff", fontFamily: "monospace" }}>
                  {extractRepo(repoUrl)}
                </span>
                <span style={{ background: "#1c2128", color: "#8b949e", fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>
                  {ANALYSES.find(a => a.key === active)?.label}
                </span>
              </div>
              <span style={{ fontSize: 11, color: "#484f58", fontFamily: "monospace" }}>last 12 months</span>
            </div>
 
            {active === "commitActivity" && <CommitActivityView data={currentResult} />}
            {active === "healthScore"    && <HealthScoreView    data={currentResult} />}
            {active === "riskDetection"  && <RiskDetectionView  data={currentResult} />}
          </div>
        )}
 
      </div>
 
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus { border-color: #388bfd !important; box-shadow: 0 0 0 3px rgba(56,139,253,.15) !important; }
        .analysis-btn:hover:not(:disabled) {
          background: #292e36 !important;
          border-color: #8b949e !important;
        }
        .analysis-btn-active:hover:not(:disabled) {
          background: #1f2937 !important;
          border-color: #58a6ff !important;
        }
        .analysis-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}