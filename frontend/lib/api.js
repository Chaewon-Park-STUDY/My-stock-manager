// 백엔드(FastAPI) 호출 함수 모음. 화면 코드는 fetch를 직접 쓰지 않고 여기만 사용합니다.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("백엔드 서버에 연결할 수 없어요. backend 폴더에서 uvicorn이 실행 중인지 확인하세요.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    // 422(입력 검증 실패)는 detail이 배열로 옴
    const msg = Array.isArray(detail)
      ? detail.map((d) => `${d.loc?.at(-1)}: ${d.msg}`).join(", ")
      : detail || `요청 실패 (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
}

const crud = (path) => ({
  list: (params) => request(path + qs(params)),
  create: (body) => request(path, { method: "POST", body }),
  update: (id, body) => request(`${path}/${id}`, { method: "PUT", body }),
  remove: (id) => request(`${path}/${id}`, { method: "DELETE" }),
});

export const api = {
  accounts: crud("/accounts"),
  trades: crud("/trades"),
  dividends: crud("/dividends"),
  interest: crud("/interest"),
  holdings: (params) => request("/holdings" + qs(params)),
  reports: {
    trading: (params) => request("/reports/trading/monthly" + qs(params)),
    dividends: (params) => request("/reports/dividends/monthly" + qs(params)),
    interest: (params) => request("/reports/interest/monthly" + qs(params)),
  },
};
