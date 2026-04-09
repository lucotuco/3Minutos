type Tone = "neutro" | "cercano" | "especialista" | "breve";

export type UserPreferences = {
  id?: string;
  name: string;
  topics: [string, string, string];
  tone: Tone;
  deliveryTime: string;
  isActive: boolean;
};

export type DigestItem = {
  articleId?: string | null;
  title: string | null;
  summary: string | null;
  topic: string;
  region?: string | null;
  section?: string | null;
  url?: string | null;
  tone?: string;
};

export type DigestResponse = {
  user: {
    id: string;
    name: string;
    tone: Tone;
    deliveryTime: string;
    topics: string[];
  };
  digest: {
    tone: string;
    items: DigestItem[];
  };
};

export type ShownArticle = {
  articleId?: string;
  title?: string;
  summary?: string;
  topic: string;
  tone: string;
  region?: string;
  section?: string;
  articleUrl?: string;
  shownDate?: string;
  shownAt: string;
};

function normalizeTone(value: unknown): Tone {
  if (
    value === "neutro" ||
    value === "cercano" ||
    value === "especialista" ||
    value === "breve"
  ) {
    return value;
  }
  return "neutro";
}

function normalizeTopics(value: unknown): [string, string, string] {
  const topics = Array.isArray(value)
    ? value.map((topic) => String(topic ?? "").trim()).slice(0, 3)
    : [];
  while (topics.length < 3) topics.push("");
  return [topics[0], topics[1], topics[2]];
}

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://threeminutos-backend.onrender.com"
).replace(/\/+$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      `No se pudo conectar al backend (${API_BASE_URL}). Revisa EXPO_PUBLIC_API_URL o que el backend este online.`
    );
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const err = data as { error?: string; message?: string } | null;
    const message = err?.error || err?.message || `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function mapPreferences(raw: {
  _id?: string;
  id?: string;
  name?: string;
  topics?: unknown;
  tone?: unknown;
  deliveryTime?: unknown;
  isActive?: unknown;
}): UserPreferences {
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: String(raw.name ?? ""),
    topics: normalizeTopics(raw.topics),
    tone: normalizeTone(raw.tone),
    deliveryTime: String(raw.deliveryTime ?? "08:00"),
    isActive: Boolean(raw.isActive ?? true),
  };
}

type RawDigest = {
  user?: {
    id?: string;
    name?: string;
    tone?: unknown;
    deliveryTime?: unknown;
    topics?: unknown;
  };
  digest?: {
    tone?: unknown;
    items?: Array<{
      articleId?: string | null;
      title?: string | null;
      summary?: string | null;
      topic?: unknown;
      region?: string | null;
      section?: string | null;
      url?: string | null;
    }>;
  };
};

function mapDigest(raw: RawDigest): DigestResponse {
  return {
    user: {
      id: String(raw.user?.id ?? ""),
      name: String(raw.user?.name ?? ""),
      tone: normalizeTone(raw.user?.tone),
      deliveryTime: String(raw.user?.deliveryTime ?? "08:00"),
      topics: Array.isArray(raw.user?.topics)
        ? raw.user.topics.map((topic) => String(topic ?? ""))
        : [],
    },
    digest: {
      tone: String(raw.digest?.tone ?? "neutro"),
      items: Array.isArray(raw.digest?.items)
        ? raw.digest.items.map((item) => ({
            articleId: item.articleId ?? undefined,
            title: item.title ?? "",
            summary: item.summary ?? "",
            topic: String(item.topic ?? ""),
            region: item.region ?? undefined,
            section: item.section ?? undefined,
            url: item.url ?? undefined,
          }))
        : [],
    },
  };
}

function mapShownArticle(raw: {
  articleId?: string;
  title?: unknown;
  summary?: unknown;
  topic?: unknown;
  tone?: unknown;
  region?: unknown;
  section?: unknown;
  articleUrl?: unknown;
  shownDate?: unknown;
  shownAt?: unknown;
}): ShownArticle {
  return {
    articleId: raw.articleId ? String(raw.articleId) : undefined,
    title: raw.title ? String(raw.title) : undefined,
    summary: raw.summary ? String(raw.summary) : undefined,
    topic: String(raw.topic ?? ""),
    tone: String(raw.tone ?? ""),
    region: raw.region ? String(raw.region) : undefined,
    section: raw.section ? String(raw.section) : undefined,
    articleUrl: raw.articleUrl ? String(raw.articleUrl) : undefined,
    shownDate: raw.shownDate ? String(raw.shownDate) : undefined,
    shownAt: String(raw.shownAt ?? ""),
  };
}

export const api = {
  async createPreferences(prefs: Omit<UserPreferences, "id">) {
    const created = await request<{
      _id?: string;
      id?: string;
      name?: string;
      topics?: unknown;
      tone?: unknown;
      deliveryTime?: unknown;
      isActive?: unknown;
    }>("/users/preferences", {
      method: "POST",
      body: JSON.stringify(prefs),
    });

    const mapped = mapPreferences(created);

    if (!mapped.id) {
      throw new Error("El backend no devolvio un id de usuario valido.");
    }

    return { id: mapped.id };
  },

  async getPreferences(userId: string) {
    const raw = await request<{
      _id?: string;
      id?: string;
      name?: string;
      topics?: unknown;
      tone?: unknown;
      deliveryTime?: unknown;
      isActive?: unknown;
    }>(`/users/preferences/${userId}`);

    return mapPreferences(raw);
  },

  async updatePreferences(userId: string, next: Omit<UserPreferences, "id">) {
    const raw = await request<{
      _id?: string;
      id?: string;
      name?: string;
      topics?: unknown;
      tone?: unknown;
      deliveryTime?: unknown;
      isActive?: unknown;
    }>(`/users/preferences/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(next),
    });

    return mapPreferences(raw);
  },

  async getDigest(userId: string): Promise<DigestResponse> {
    const raw = await request<RawDigest>(`/users/${userId}/digest`);
    return mapDigest(raw);
  },

  async refreshDigest(userId: string): Promise<DigestResponse> {
    const raw = await request<RawDigest>(`/users/${userId}/digest/refresh`, {
      method: "POST",
    });
    return mapDigest(raw);
  },

  async markDigestShown(userId: string, payload: { items: DigestItem[]; tone: string }) {
    return request<{ ok: boolean }>(`/users/${userId}/digest/mark-shown`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getShownArticles(userId: string): Promise<ShownArticle[]> {
    const raw = await request<
      Array<{
        articleId?: string;
        title?: unknown;
        summary?: unknown;
        topic?: unknown;
        tone?: unknown;
        region?: unknown;
        section?: unknown;
        articleUrl?: unknown;
        shownDate?: unknown;
        shownAt?: unknown;
      }>
    >(`/users/${userId}/shown-articles`);

    return Array.isArray(raw) ? raw.map(mapShownArticle) : [];
  },
};

export default api;