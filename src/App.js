import React, { useEffect, useMemo, useState } from "react";

// ✅ 순수 React 버전 (외부 UI 라이브러리 없음)
// - 기능 복구: 검색, 정렬, 되돌리기, PIN 잠금, 칠판 전환, 칸 크기(밀도), 내보내기/가져오기, 편집 모달
// - 글씨 잘림 방지: 박스 "최소" 높이 + 가변 레이아웃(줄바꿈 옵션)

// —— 안전 스토리지 ——
const isClient = typeof window !== "undefined";
const safeGet = (key, fallback = null) => {
  if (!isClient) return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const safeSet = (key, value) => {
  if (!isClient) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
};

// —— 키 ——
const STORAGE_KEY = "seat-market-v6"; // v6: 기능 복구 + 가변 높이
const PIN_KEY = "seat-market-pin";
const LOCK_KEY = "seat-market-locked";
const BOARD_KEY = "seat-market-board-top";
const DENSITY_KEY = "seat-market-density"; // small | medium | large
const WRAP_KEY = "seat-market-wrap"; // true | false (텍스트 줄바꿈)

// —— 유틸 ——
const KRW = (n) =>
  (Number(n) || 0).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원";
const now = () => new Date().toISOString();

// 라벨 생성: 3분단 × (A-D) × (1-2) = 24
const makeLabels = () => {
  const labels = [];
  for (let b = 1; b <= 3; b++) {
    for (let r = 0; r < 4; r++) {
      const rowChar = String.fromCharCode(65 + r); // A-D
      for (let c = 1; c <= 2; c++) labels.push(`${b}${rowChar}${c}`);
    }
  }
  return labels;
};

const defaultSeats = () =>
  makeLabels().map((label, i) => ({
    id: i + 1,
    label,
    block: Number(label[0]),
    row: label[1],
    col: Number(label[2]),
    owner: "",
    tenant: "",
    price: 0,
    rentFee: 0,
    lastUpdated: now(),
    history: [],
  }));

const loadState = () => {
  try {
    const raw = safeGet(STORAGE_KEY);
    if (!raw) return defaultSeats();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 24) return defaultSeats();
    return parsed;
  } catch {
    return defaultSeats();
  }
};

const saveState = (seats) => safeSet(STORAGE_KEY, JSON.stringify(seats));
const loadPin = () => safeGet(PIN_KEY, "");
const savePin = (pin) => safeSet(PIN_KEY, pin || "");
const loadLocked = () => safeGet(LOCK_KEY, "true") === "true"; // 기본 잠금 ON
const saveLocked = (v) => safeSet(LOCK_KEY, String(!!v));
const loadBoardTop = () => safeGet(BOARD_KEY, "true") === "true"; // 칠판 상단 기본
const saveBoardTop = (v) => safeSet(BOARD_KEY, String(!!v));
const loadDensity = () => safeGet(DENSITY_KEY, "medium");
const saveDensity = (v) => safeSet(DENSITY_KEY, v);
const loadWrap = () => safeGet(WRAP_KEY, "false") === "true";
const saveWrap = (v) => safeSet(WRAP_KEY, String(!!v));

// —— 스타일 ——
const S = {
  page: {
    background: "#fff",
    color: "#1f2937",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  container: { maxWidth: 1100, margin: "0 auto", padding: "20px 14px 80px" },
  hstack: { display: "flex", alignItems: "center", gap: 8 },
  rowBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  btn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
  },
  input: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
    width: "80%",
  },
  select: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111827",
  },
  sectionCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 12,
  },
  badge: {
    fontSize: 12,
    padding: "2px 6px",
    borderRadius: 6,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
  },
  blockTitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 6,
    fontWeight: 600,
  },
  seatBtn: (bg, border, minH) => ({
    position: "relative",
    minHeight: minH,
    padding: 10,
    borderRadius: 10,
    textAlign: "left",
    border: `1px solid ${border}`,
    background: bg,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }),
  label: { fontSize: 13, fontWeight: 700, color: "#374151" },
  line: (wrap) => ({
    fontSize: 12,
    color: "#374151",
    whiteSpace: wrap ? "normal" : "nowrap",
    overflow: wrap ? "visible" : "hidden",
    textOverflow: wrap ? "clip" : "ellipsis",
  }),
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 12,
    marginTop: 12,
  },
  grid24Wrap: { display: "grid", gridTemplateRows: "repeat(4,auto)", gap: 8 },
  row2: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 },
  board: {
    marginTop: 12,
    padding: "6px 10px",
    fontSize: 13,
    textAlign: "center",
    borderRadius: 10,
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 8,
    marginTop: 14,
    textAlign: "center",
  },
  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 8,
    fontSize: 13,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: 16,
    width: 440,
    maxWidth: "92vw",
  },
  fieldLabel: { fontSize: 12, marginBottom: 4, color: "#374151" },
};

export default function SeatMarketApp() {
  // 상태
  const [seats, setSeats] = useState(loadState);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("label");
  const [pin, setPin] = useState(loadPin);
  const [locked, setLocked] = useState(loadLocked);
  const [boardTop, setBoardTop] = useState(loadBoardTop);
  const [density, setDensity] = useState(loadDensity); // small | medium | large
  const [wrap, setWrap] = useState(loadWrap); // 글자 줄바꿈
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [undoStack, setUndoStack] = useState([]);

  // 동기화
  useEffect(() => saveState(seats), [seats]);
  useEffect(() => savePin(pin), [pin]);
  useEffect(() => saveLocked(locked), [locked]);
  useEffect(() => saveBoardTop(boardTop), [boardTop]);
  useEffect(() => saveDensity(density), [density]);
  useEffect(() => saveWrap(wrap), [wrap]);

  // 파생값
  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    let list = [...seats];
    if (text) {
      list = list.filter(
        (s) =>
          s.label.toLowerCase().includes(text) ||
          s.owner.toLowerCase().includes(text) ||
          s.tenant.toLowerCase().includes(text)
      );
    }
    if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    else if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
    else if (sort === "vacant")
      list.sort((a, b) => (a.tenant ? 1 : 0) - (b.tenant ? 1 : 0));
    else list.sort((a, b) => a.label.localeCompare(b.label, "ko"));
    return list;
  }, [seats, q, sort]);

  const stats = useMemo(() => {
    const total = seats.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    const avg = total / seats.length;
    const max = seats.slice().sort((a, b) => b.price - a.price)[0];
    return { total, avg, max };
  }, [seats]);

  // 편집 보호 & 되돌리기
  const pushUndo = (prev) =>
    setUndoStack((st) => [JSON.stringify(prev), ...st].slice(0, 15));
  const undo = () => {
    if (!undoStack.length) return alert("되돌릴 기록이 없음");
    const [top, ...rest] = undoStack;
    setSeats(JSON.parse(top));
    setUndoStack(rest);
  };
  const requireEdit = (action) => {
    if (!pin) return action(); // PIN 미설정 시 자유 편집
    if (!locked) return action(); // 잠금 해제 상태
    const input = window.prompt("편집 PIN 입력");
    if (input === pin) action();
    else window.alert("PIN 불일치");
  };

  const updateSeat = (id, patch, note) => {
    setSeats((prev) => {
      const snapshot = prev.map((s) => ({ ...s }));
      pushUndo(snapshot);
      return prev.map((s) =>
        s.id === id
          ? {
              ...s,
              ...patch,
              lastUpdated: now(),
              history: note
                ? [{ time: now(), note }, ...(s.history || [])].slice(0, 20)
                : s.history,
            }
          : s
      );
    });
  };

  const resetAll = () => {
    if (!window.confirm("전체 초기화함? (되돌리기 가능)")) return;
    pushUndo(seats);
    setSeats(defaultSeats());
  };

  const activeSeat = seats.find((s) => s.id === activeId) || null;

  // 밀도 → 최소 높이 매핑 (줄바꿈 고려)
  const seatMinH =
    density === "small"
      ? wrap
        ? 78
        : 60
      : density === "large"
      ? wrap
        ? 118
        : 90
      : wrap
      ? 98
      : 75;
  const seatColor = (vacant) => ({
    bg: vacant ? "#fff1f2" : "#f0f9ff",
    border: vacant ? "#fecdd3" : "#bae6fd",
  });

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* 헤더 */}
        <div style={S.rowBetween}>
          <div style={S.hstack}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              🎒
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>신남 좌석 매매·임대장</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                3분단(2×4) = 24석 · 로컬 저장
              </div>
            </div>
          </div>
          <div style={S.hstack}>
            <button style={S.btn} onClick={undo}>
              ⏪ 되돌리기
            </button>
            <details>
              <summary style={S.btn}>⚙️ 설정</summary>
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 6,
                  minWidth: 280,
                }}
              >
                <div
                  style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}
                >
                  보안/데이터
                </div>
                <div style={S.rowBetween}>
                  <span>편집 잠금</span>
                  <input
                    type="checkbox"
                    checked={locked}
                    onChange={(e) => setLocked(e.target.checked)}
                  />
                </div>
                <div style={{ ...S.rowBetween, marginTop: 6 }}>
                  <span>PIN</span>
                  <input
                    style={{ ...S.input, width: 120 }}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="숫자 4자리"
                  />
                </div>
                <div
                  style={{ borderTop: "1px solid #e5e7eb", margin: "10px 0" }}
                />
                <div
                  style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}
                >
                  배치/표시
                </div>
                <button style={S.btn} onClick={() => setBoardTop((v) => !v)}>
                  칠판 위치 전환 (현재 {boardTop ? "상단" : "하단"})
                </button>
                <div style={{ ...S.rowBetween, marginTop: 8 }}>
                  <span>칸 크기</span>
                  <select
                    style={S.select}
                    value={density}
                    onChange={(e) => setDensity(e.target.value)}
                  >
                    <option value="small">작게</option>
                    <option value="medium">보통</option>
                    <option value="large">크게</option>
                  </select>
                </div>
                <div style={{ ...S.rowBetween, marginTop: 8 }}>
                  <span>텍스트 줄바꿈</span>
                  <input
                    type="checkbox"
                    checked={wrap}
                    onChange={(e) => setWrap(e.target.checked)}
                  />
                </div>
                <div
                  style={{ borderTop: "1px solid #e5e7eb", margin: "10px 0" }}
                />
                <div style={S.hstack}>
                  <button style={S.btn} onClick={() => setExportOpen(true)}>
                    데이터 내보내기
                  </button>
                  <button style={S.btn} onClick={() => setImportOpen(true)}>
                    데이터 가져오기
                  </button>
                  <button style={S.btn} onClick={resetAll}>
                    전체 초기화
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* 검색/정렬 */}
        <div style={{ ...S.hstack, marginTop: 10 }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="좌석 라벨(예: 2B1), 소유주, 임차인 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            style={S.select}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="label">라벨순</option>
            <option value="priceDesc">가격 높은순</option>
            <option value="priceAsc">가격 낮은순</option>
            <option value="vacant">빈자리 우선</option>
          </select>
        </div>

        {/* 칠판 표시 */}
        {boardTop && <div style={S.board}>🧑‍🏫 칠판 (교탁) — 이쪽이 앞</div>}

        {/* 3분단 좌석 맵 */}
        <div style={S.grid3}>
          {[1, 2, 3].map((block) => (
            <div key={block} style={S.sectionCard}>
              <div style={S.blockTitle}>{block}분단</div>
              <div style={S.grid24Wrap}>
                {Array.from({ length: 4 }).map((_, rIdx) => (
                  <div key={rIdx} style={S.row2}>
                    {Array.from({ length: 2 }).map((_, cIdx) => {
                      const rowChar = String.fromCharCode(65 + rIdx);
                      const col = cIdx + 1;
                      const label = `${block}${rowChar}${col}`;
                      const seat = seats.find((s) => s.label === label);
                      const vacant = !seat?.tenant;
                      const { bg, border } = seatColor(vacant);
                      return (
                        <button
                          key={label}
                          onClick={() => {
                            setActiveId(seat.id);
                            setEditOpen(true);
                          }}
                          style={S.seatBtn(bg, border, seatMinH)}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div style={S.label}>{label}</div>
                            <span style={S.badge}>
                              {vacant ? "빈" : "임대중"}
                            </span>
                          </div>
                          <div style={S.line(wrap)}>
                            소유주: {seat.owner || "-"}
                          </div>
                          <div style={S.line(wrap)}>
                            임차인: {seat.tenant || "-"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {KRW(seat.price)}{" "}
                            <span style={{ color: "#6b7280", fontWeight: 400 }}>
                              (임대료 {KRW(seat.rentFee)})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!boardTop && <div style={S.board}>🧑‍🏫 칠판 (교탁) — 이쪽이 앞</div>}

        {/* 요약 */}
        <div style={S.summary}>
          <div style={S.summaryCard}>
            <div style={{ color: "#6b7280" }}>총 시가</div>
            <div style={{ fontWeight: 800 }}>{KRW(stats.total)}</div>
          </div>
          <div style={S.summaryCard}>
            <div style={{ color: "#6b7280" }}>평균가</div>
            <div style={{ fontWeight: 800 }}>{KRW(stats.avg)}</div>
          </div>
          <div style={S.summaryCard}>
            <div style={{ color: "#6b7280" }}>최고가</div>
            <div style={{ fontWeight: 800 }}>
              {stats.max ? `${stats.max.label} · ${KRW(stats.max.price)}` : "-"}
            </div>
          </div>
        </div>

        {/* 편집 모달 */}
        {editOpen && activeSeat && (
          <div style={S.modalBackdrop} onClick={() => setEditOpen(false)}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                좌석 정보 수정
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                라벨: <b style={{ color: "#111827" }}>{activeSeat.label}</b>
              </div>
              <div style={S.row2}>
                <div>
                  <div style={S.fieldLabel}>소유주</div>
                  <input
                    style={S.input}
                    value={activeSeat.owner}
                    onChange={(e) =>
                      requireEdit(() =>
                        updateSeat(
                          activeSeat.id,
                          { owner: e.target.value },
                          `소유주 → ${e.target.value}`
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <div style={S.fieldLabel}>임차인</div>
                  <input
                    style={S.input}
                    value={activeSeat.tenant}
                    onChange={(e) =>
                      requireEdit(() =>
                        updateSeat(
                          activeSeat.id,
                          { tenant: e.target.value },
                          `임차인 → ${e.target.value}`
                        )
                      )
                    }
                  />
                </div>
              </div>
              <div style={{ ...S.row2, marginTop: 8 }}>
                <div>
                  <div style={S.fieldLabel}>가격</div>
                  <input
                    type="number"
                    style={S.input}
                    value={activeSeat.price}
                    onChange={(e) =>
                      requireEdit(() =>
                        updateSeat(
                          activeSeat.id,
                          { price: Number(e.target.value || 0) },
                          `가격 → ${e.target.value}`
                        )
                      )
                    }
                  />
                </div>
                <div>
                  <div style={S.fieldLabel}>임대료</div>
                  <input
                    type="number"
                    style={S.input}
                    value={activeSeat.rentFee}
                    onChange={(e) =>
                      requireEdit(() =>
                        updateSeat(
                          activeSeat.id,
                          { rentFee: Number(e.target.value || 0) },
                          `임대료 → ${e.target.value}`
                        )
                      )
                    }
                  />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button style={S.btn} onClick={() => setEditOpen(false)}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 내보내기 모달 */}
        {exportOpen && (
          <div style={S.modalBackdrop} onClick={() => setExportOpen(false)}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                데이터 내보내기 (JSON)
              </div>
              <textarea
                readOnly
                style={{ ...S.input, height: 220 }}
                value={JSON.stringify(seats, null, 2)}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button
                  style={S.btn}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(seats));
                    alert("복사됨");
                  }}
                >
                  복사
                </button>
                <button style={S.btn} onClick={() => setExportOpen(false)}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 가져오기 모달 */}
        {importOpen && (
          <ImportModal
            onClose={() => setImportOpen(false)}
            onLoad={(data) => {
              if (!Array.isArray(data) || data.length !== 24)
                return alert("형식 오류: 배열 24개 필요");
              requireEdit(() => setSeats(data));
              setImportOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

function ImportModal({ onClose, onLoad }) {
  const [raw, setRaw] = useState("");
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          데이터 가져오기 (JSON 붙여넣기)
        </div>
        <textarea
          style={{ ...S.input, height: 220 }}
          placeholder="여기에 JSON 붙여넣기"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
            style={S.btn}
            onClick={() => {
              try {
                const data = JSON.parse(raw);
                onLoad(data);
              } catch (e) {
                alert("JSON 파싱 오류");
              }
            }}
          >
            불러오기
          </button>
          <button style={S.btn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
