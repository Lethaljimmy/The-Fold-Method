import { useState, useRef, useEffect } from "react";

const GOLD = "#C9A84C";
const DARK = "#0D0D0D";
const SURFACE = "#161616";
const SURFACE2 = "#1E1E1E";
const MUTED = "#555";
const TEXT = "#E8E8E8";
const RED = "#c0392b";

const STEPS = [
  {
    key: "F",
    label: "FOCUS",
    sub: "only on what you control",
    question: "What part of this situation is actually in your control right now?",
    userHint: "Not what you wish you could control. Not what you think should be. What literally is.",
    coachHint: "If they list things outside their control, bring them back. Only what they can literally act on counts here.",
  },
  {
    key: "O",
    label: "OWN",
    sub: "only what's yours",
    question: "What part of this is genuinely yours to carry?",
    userHint: "Your behavior. Your actions. Your choices. That's all that belongs to you here.",
    coachHint: "Focus only on their own behavior, actions, and choices. If they bring up what someone else did, redirect them back to themselves. Nothing outside their own conduct belongs to them.",
  },
  {
    key: "L",
    label: "LET",
    sub: "time take care of time",
    question: "What in this situation are you trying to force that time would handle better?",
    userHint: "Remember — in time, it will get better. Focus on that. Not the urgency of right now.",
    coachHint: "Help them identify what they are gripping too hard. Remind them that in time it will get better. The goal is to release urgency — not everything needs to be solved today.",
  },
  {
    key: "D",
    label: "DECIDE",
    sub: "the meaning",
    question: "What meaning will you choose to assign to this moment?",
    userHint: "Not the positive spin. Not what sounds good. The meaning that actually serves you moving forward.",
    coachHint: "Push back if the meaning they choose keeps them stuck or makes them a victim. The meaning should be conducive to them — not performance, not forced positivity. What actually moves them forward?",
  },
];

function buildStepPrompt(step, situation, previousAnswers, userResponse) {
  const prior = previousAnswers.length > 0
    ? `What they have worked through so far:\n${previousAnswers.map((a, i) => `${STEPS[i].key} — ${STEPS[i].label}: "${a.userResponse}"\nYour reflection: ${a.coachReply}`).join("\n\n")}`
    : "";
  return `You are a FOLD coach. FOLD is a 4-step mental reset framework created by Tyler Brown:
F — Focus only on what you control
O — Own only what's yours
L — Let time take care of time
D — Decide the meaning

The user is on step ${step.key} — ${step.label}: ${step.sub}.
Coaching guideline: ${step.coachHint}
Their situation: "${situation}"
${prior}

Their response: "${userResponse}"

Your role:
- 2 to 4 sentences only.
- Direct. Not cold, not soft. Coach, not therapist.
- Do not validate surface answers. Push if they deflect or stay shallow.
- Stay strictly inside this step only.
- End with ONE sharp follow-up question — OR the exact phrase "You're ready to move forward." Only use that phrase if their answer genuinely earns it.
- No bullet points. No headers. Sound like someone who has sat with people in real crisis.`;
}

function buildClosingPrompt(situation, answers) {
  const summary = STEPS.map((s, i) => `${s.key} — ${s.label}: "${answers[i]?.userResponse}"`).join("\n");
  return `You are a FOLD coach. Someone just completed the full FOLD process.
Their situation: "${situation}"
What they worked through:
${summary}

Write a closing message. 3 to 5 sentences. Personal — reference what they actually said, especially the meaning they chose in D. Acknowledge the weight of what they moved through. Send them back into their life feeling grounded, not pumped up. End with one short powerful sentence they can carry with them.
No bullet points. No headers. No generic encouragement. Write like you have been in the room with them the whole time.`;
}

function buildCrisisPrompt(userResponse) {
  return `You are a FOLD crisis coach. FOLD is a mental reset framework: Focus only on what you control, Own only what's yours, Let time take care of time, Decide the meaning.

Someone is about to react emotionally or do something destructive. They just said: "${userResponse}"

In 3 sentences: interrupt the pattern. Name what is actually happening underneath the reaction — is this about control, ownership, urgency, or meaning? Be direct and human. Do not lecture. Do not list steps.

Then ask ONE question — the most important question that will slow them down right now. Make it land like a coach who has been in the room with people at their worst.

No bullet points. No headers. Short. Sharp. Real.`;
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.find((b) => b.type === "text")?.text || "";
}

export default function FOLDCoach() {
  const [phase, setPhase] = useState("intro");
  const [situation, setSituation] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState("");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coachReply, setCoachReply] = useState("");
  const [readyToAdvance, setReadyToAdvance] = useState(false);
  const [closingMessage, setClosingMessage] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);
  const [crisisInput, setCrisisInput] = useState("");
  const [crisisReply, setCrisisReply] = useState("");
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [crisisDone, setCrisisDone] = useState(false);
  const [legalView, setLegalView] = useState(null); // null | "privacy" | "terms"
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachReply, phase, stepIndex, closingMessage, crisisReply, legalView]);

  const step = STEPS[stepIndex];

  async function handleStepSubmit() {
    if (!currentInput.trim() || loading) return;
    setLoading(true);
    setCoachReply("");
    setReadyToAdvance(false);
    try {
      const reply = await callClaude(buildStepPrompt(step, situation, answers, currentInput.trim()));
      setCoachReply(reply || "Take a breath. Keep going.");
      setReadyToAdvance(true);
    } catch {
      setCoachReply("Something went wrong. Try again.");
    }
    setLoading(false);
  }

  function handleAdvance() {
    const newAnswers = [...answers, { userResponse: currentInput.trim(), coachReply }];
    setAnswers(newAnswers);
    setCurrentInput("");
    setCoachReply("");
    setReadyToAdvance(false);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setPhase("complete");
      handleClosing(newAnswers);
    }
  }

  async function handleClosing(finalAnswers) {
    setClosingLoading(true);
    try {
      const msg = await callClaude(buildClosingPrompt(situation, finalAnswers));
      setClosingMessage(msg || "You moved through something real today. Keep going.");
    } catch {
      setClosingMessage("You moved through something real today. That takes more than most people give themselves credit for. Keep going.");
    }
    setClosingLoading(false);
  }

  async function handleCrisisSubmit() {
    if (!crisisInput.trim() || crisisLoading) return;
    setCrisisLoading(true);
    setCrisisReply("");
    try {
      const reply = await callClaude(buildCrisisPrompt(crisisInput.trim()));
      setCrisisReply(reply || "Before you do anything — what are you actually trying to protect right now?");
      setCrisisDone(true);
    } catch {
      setCrisisReply("Take a breath. Before you move — what are you actually trying to protect right now?");
      setCrisisDone(true);
    }
    setCrisisLoading(false);
  }

  function goToFullProcess() {
    setCrisisInput("");
    setCrisisReply("");
    setCrisisDone(false);
    setPhase("situation");
  }

  function resetAll() {
    setPhase("intro");
    setSituation("");
    setStepIndex(0);
    setCurrentInput("");
    setAnswers([]);
    setLoading(false);
    setCoachReply("");
    setReadyToAdvance(false);
    setClosingMessage("");
    setClosingLoading(false);
    setCrisisInput("");
    setCrisisReply("");
    setCrisisLoading(false);
    setCrisisDone(false);
    setLegalView(null);
  }

  // Legal modal overlay
  if (legalView) {
    return (
      <div style={{ minHeight: "100vh", background: DARK, color: TEXT, fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 80px" }}>
        <div style={{ width: "100%", maxWidth: 600, padding: "36px 24px 0" }}>
          <button onClick={() => setLegalView(null)} style={{ background: "none", border: "none", color: GOLD, fontSize: 13, cursor: "pointer", fontFamily: "sans-serif", letterSpacing: 1, padding: 0, marginBottom: 28 }}>
            ← Back
          </button>

          {legalView === "privacy" && (
            <>
              <p style={{ fontSize: 11, color: GOLD, letterSpacing: 3, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 16 }}>Privacy Policy</p>
              <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>Your data stays yours.</p>
              <p style={{ fontSize: 15, color: "#aaa", lineHeight: 1.85 }}>
                FOLD does not store, share, or sell your session data. What you write stays on your device. We do not collect personal information unless you create an account. If that changes, this policy will be updated and you will be notified.
              </p>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginTop: 24 }}>
                Last updated: 2025. Never Casual Enterprises LLC.
              </p>
            </>
          )}

          {legalView === "terms" && (
            <>
              <p style={{ fontSize: 11, color: GOLD, letterSpacing: 3, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 16 }}>Terms of Use</p>
              <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>How this works.</p>
              <p style={{ fontSize: 15, color: "#aaa", lineHeight: 1.85 }}>
                FOLD is a wellness and personal development tool created by Tyler Brown and Never Casual Enterprises LLC. It is not a licensed mental health service and does not constitute therapy, counseling, or clinical treatment. By using this app you agree that you are using it for personal growth purposes only and that Never Casual Enterprises LLC is not liable for decisions made based on your use of this tool.
              </p>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginTop: 24 }}>
                Last updated: 2025. Never Casual Enterprises LLC.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: DARK, color: TEXT, fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 80px" }}>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: 600, padding: "36px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
          {"FOLD".split("").map((l, i) => (
            <span key={i} style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: 6,
              color: (phase === "stepping" && i === stepIndex) || phase === "complete" ? GOLD : "#2e2e2e",
              fontFamily: "'Arial Black', sans-serif",
              transition: "color 0.4s",
            }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: 3, textTransform: "uppercase", fontFamily: "sans-serif" }}>
          A Process Faster Than Fear
        </div>
        {phase === "stepping" && (
          <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{ height: 3, flex: 1, background: i <= stepIndex ? GOLD : "#222", borderRadius: 2, transition: "background 0.4s" }} />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ width: "100%", maxWidth: 600, padding: "40px 24px 0", flex: 1 }}>

        {/* INTRO */}
        {phase === "intro" && (
          <div>
            <p style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>
              What do you need right now?
            </p>
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.8, marginBottom: 36 }}>
              FOLD won't always change what's happening.<br />
              It will always change who you are while it's happening.
            </p>

            <Btn onClick={() => setPhase("situation")}>I need to process something</Btn>

            <div style={{ marginTop: 12 }}>
              <button onClick={() => setPhase("crisis")} style={{
                background: "transparent", color: RED, border: `1px solid ${RED}`,
                borderRadius: 6, padding: "14px 28px", fontSize: 13, fontWeight: 700,
                letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Arial Black', sans-serif",
                cursor: "pointer", width: "100%",
              }}>
                I'm about to react
              </button>
            </div>

            {/* Home disclaimer */}
            <p style={{ fontSize: 12, color: "#3a3a3a", lineHeight: 1.7, marginTop: 32, textAlign: "center" }}>
              FOLD is a self-guided mental reset tool, not a substitute for professional mental health treatment.{" "}
              If you are in crisis, call or text <span style={{ color: MUTED }}>988</span>.
            </p>
          </div>
        )}

        {/* CRISIS */}
        {phase === "crisis" && (
          <div>
            {/* Crisis disclaimer */}
            <div style={{ background: "#0d0000", border: `1px solid #3a0000`, borderRadius: 8, padding: "14px 16px", marginBottom: 28 }}>
              <p style={{ fontSize: 12, color: "#7a3030", lineHeight: 1.7, margin: 0 }}>
                This tool is not a crisis intervention service. If you or someone else is in immediate danger, call <strong>911</strong>. For mental health crisis support, call or text <strong>988</strong>.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RED }} />
              <span style={{ fontSize: 11, color: RED, letterSpacing: 3, textTransform: "uppercase", fontFamily: "sans-serif" }}>Crisis Mode</span>
            </div>

            {!crisisDone && (
              <>
                <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.6, marginBottom: 10 }}>
                  Stop. What are you about to do?
                </p>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 24, fontStyle: "italic" }}>
                  Don't filter it. Say exactly what you're thinking about doing right now.
                </p>
                <Textarea value={crisisInput} onChange={e => setCrisisInput(e.target.value)} placeholder="Write it here..." rows={4} />
                <Btn onClick={handleCrisisSubmit} disabled={!crisisInput.trim() || crisisLoading}>
                  {crisisLoading ? "Processing..." : "Submit"}
                </Btn>
              </>
            )}

            {crisisDone && (
              <>
                <div style={{ background: "#110000", borderLeft: `3px solid ${RED}`, padding: "20px", borderRadius: "0 8px 8px 0", marginBottom: 28 }}>
                  <div style={{ fontSize: 11, color: RED, letterSpacing: 2, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 10 }}>Coach</div>
                  <p style={{ fontSize: 15, lineHeight: 1.85, color: "#ccc", margin: 0 }}>{crisisReply}</p>
                </div>
                <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 8 }}>
                  When you're ready — do you want to FOLD through what's underneath this?
                </p>
                <Btn onClick={goToFullProcess}>Yes — take me through the full process</Btn>
                <button onClick={resetAll} style={{
                  background: "transparent", color: MUTED, border: "none",
                  padding: "14px", fontSize: 13, cursor: "pointer", width: "100%",
                  marginTop: 8, fontFamily: "sans-serif",
                }}>
                  I'm good. Take me back.
                </button>
              </>
            )}
          </div>
        )}

        {/* SITUATION */}
        {phase === "situation" && (
          <div>
            <Label>Before we start</Label>
            <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>What's actually going on?</p>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 24, lineHeight: 1.7 }}>
              Don't edit it. Don't make it sound better than it feels. Just say it.
            </p>
            <Textarea value={situation} onChange={e => setSituation(e.target.value)} placeholder="Write it here..." rows={5} />
            <Btn onClick={() => situation.trim() && setPhase("stepping")} disabled={!situation.trim()}>Let's go</Btn>
          </div>
        )}

        {/* STEPPING */}
        {phase === "stepping" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: GOLD, fontFamily: "'Arial Black', sans-serif", lineHeight: 1 }}>{step.key}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "sans-serif" }}>{step.label}</div>
                  <div style={{ fontSize: 12, color: MUTED, fontFamily: "sans-serif" }}>{step.sub}</div>
                </div>
              </div>
              <p style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.6, marginBottom: 10 }}>{step.question}</p>
              <p style={{ fontSize: 13, color: "#555", fontStyle: "italic", lineHeight: 1.6 }}>{step.userHint}</p>
            </div>

            {!coachReply && (
              <>
                <Textarea value={currentInput} onChange={e => setCurrentInput(e.target.value)} placeholder="Write your answer..." rows={4} />
                <Btn onClick={handleStepSubmit} disabled={!currentInput.trim() || loading}>
                  {loading ? "Processing..." : "Submit"}
                </Btn>
              </>
            )}

            {coachReply && (
              <div style={{ background: SURFACE2, borderLeft: `3px solid ${GOLD}`, padding: "20px", borderRadius: "0 8px 8px 0", marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: 2, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 10 }}>Coach</div>
                <p style={{ fontSize: 15, lineHeight: 1.8, color: "#ccc", margin: 0 }}>{coachReply}</p>
              </div>
            )}

            {readyToAdvance && (
              <Btn onClick={handleAdvance}>
                {stepIndex < STEPS.length - 1 ? `Next — ${STEPS[stepIndex + 1].label}` : "Complete the process"}
              </Btn>
            )}
          </div>
        )}

        {/* COMPLETE */}
        {phase === "complete" && (
          <div>
            <Label>You did the work</Label>
            <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.5, marginBottom: 32 }}>You just FOLDed through it.</p>

            <div style={{ background: SURFACE2, borderLeft: `3px solid ${GOLD}`, padding: "24px 20px", borderRadius: "0 8px 8px 0", marginBottom: 36 }}>
              <div style={{ fontSize: 11, color: GOLD, letterSpacing: 2, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 12 }}>From your coach</div>
              {closingLoading
                ? <p style={{ fontSize: 15, color: "#444", fontStyle: "italic", margin: 0 }}>Writing your closing message...</p>
                : <p style={{ fontSize: 16, lineHeight: 1.85, color: "#ddd", margin: 0 }}>{closingMessage}</p>
              }
            </div>

            <div style={{ fontSize: 11, color: MUTED, letterSpacing: 2, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 16 }}>Your session</div>
            {STEPS.map((s, i) => (
              <div key={i} style={{ background: SURFACE, borderRadius: 10, padding: "18px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: GOLD, fontFamily: "'Arial Black', sans-serif" }}>{s.key}</span>
                  <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, fontFamily: "sans-serif" }}>{s.label}</span>
                </div>
                <p style={{ fontSize: 14, color: "#aaa", lineHeight: 1.65, margin: 0 }}>{answers[i]?.userResponse}</p>
              </div>
            ))}

            <p style={{ fontSize: 13, color: "#333", lineHeight: 1.8, marginTop: 32, marginBottom: 32, fontStyle: "italic", textAlign: "center" }}>
              "FOLD won't always change what's happening.<br />It will always change who you are while it's happening."
            </p>
            <Btn onClick={resetAll}>FOLD through something else</Btn>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ width: "100%", maxWidth: 600, padding: "48px 24px 0", display: "flex", justifyContent: "center", gap: 24 }}>
        <button onClick={() => setLegalView("privacy")} style={{
          background: "none", border: "none", color: "#2e2e2e", fontSize: 11,
          cursor: "pointer", fontFamily: "sans-serif", letterSpacing: 1, textTransform: "uppercase",
        }}>Privacy Policy</button>
        <span style={{ color: "#2e2e2e", fontSize: 11 }}>·</span>
        <button onClick={() => setLegalView("terms")} style={{
          background: "none", border: "none", color: "#2e2e2e", fontSize: 11,
          cursor: "pointer", fontFamily: "sans-serif", letterSpacing: 1, textTransform: "uppercase",
        }}>Terms of Use</button>
        <span style={{ color: "#2e2e2e", fontSize: 11 }}>·</span>
        <span style={{ color: "#2e2e2e", fontSize: 11, fontFamily: "sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>© Never Casual Enterprises LLC</span>
      </div>

      <div ref={bottomRef} />
    </div>
  );
}

function Btn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#1a1a1a" : GOLD,
      color: disabled ? "#333" : "#000",
      border: "none", borderRadius: 6, padding: "14px 28px", fontSize: 13,
      fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase",
      fontFamily: "'Arial Black', sans-serif",
      cursor: disabled ? "not-allowed" : "pointer",
      marginTop: 16, width: "100%", transition: "all 0.2s",
    }}>{children}</button>
  );
}

function Textarea({ value, onChange, placeholder, rows }) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{
      width: "100%", background: SURFACE, border: "1px solid #222", borderRadius: 8,
      color: TEXT, fontSize: 15, lineHeight: 1.7, padding: "16px",
      fontFamily: "'Georgia', serif", resize: "vertical", outline: "none", boxSizing: "border-box",
    }} />
  );
}

function Label({ children }) {
  return (
    <p style={{ fontSize: 11, color: GOLD, letterSpacing: 3, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 16 }}>
      {children}
    </p>
  );
}
