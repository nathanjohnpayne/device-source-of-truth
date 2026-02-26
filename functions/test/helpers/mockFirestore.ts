/**
 * In-memory Firestore mock supporting the chainable query patterns
 * used throughout the backend routes.
 */

export const DOCUMENT_ID_SENTINEL = '__docId__';

type DocData = Record<string, unknown>;

export class MockDocRef {
  constructor(
    private store: Map<string, Map<string, DocData>>,
    private collName: string,
    public readonly id: string,
  ) {}

  async get(): Promise<MockDocSnapshot> {
    const coll = this.store.get(this.collName);
    const data = coll?.get(this.id) ?? null;
    return new MockDocSnapshot(this.id, data, this.store, this.collName);
  }

  async update(data: DocData): Promise<void> {
    let coll = this.store.get(this.collName);
    if (!coll) {
      coll = new Map();
      this.store.set(this.collName, coll);
    }
    const existing = coll.get(this.id) ?? {};
    coll.set(this.id, { ...existing, ...data });
  }

  async set(data: DocData, _options?: { merge?: boolean }): Promise<void> {
    let coll = this.store.get(this.collName);
    if (!coll) {
      coll = new Map();
      this.store.set(this.collName, coll);
    }
    if (_options?.merge) {
      const existing = coll.get(this.id) ?? {};
      coll.set(this.id, { ...existing, ...data });
    } else {
      coll.set(this.id, { ...data });
    }
  }

  async delete(): Promise<void> {
    this.store.get(this.collName)?.delete(this.id);
  }

  get ref(): MockDocRef {
    return this;
  }
}

export class MockDocSnapshot {
  public readonly exists: boolean;

  constructor(
    public readonly id: string,
    private _data: DocData | null,
    private store: Map<string, Map<string, DocData>>,
    private collName: string,
  ) {
    this.exists = _data != null;
  }

  data(): DocData | undefined {
    return this._data ? { ...this._data } : undefined;
  }

  get ref(): MockDocRef {
    return new MockDocRef(this.store, this.collName, this.id);
  }
}

export class MockQuerySnapshot {
  constructor(public readonly docs: MockDocSnapshot[]) {}
  get empty() { return this.docs.length === 0; }
  get size() { return this.docs.length; }
}

type FilterFn = (id: string, data: DocData) => boolean;

export class MockCollectionRef {
  private filters: FilterFn[] = [];
  private sortField?: string;
  private sortDir: 'asc' | 'desc' = 'asc';
  private limitN?: number;

  constructor(
    private store: Map<string, Map<string, DocData>>,
    private name: string,
  ) {}

  private getEntries(): [string, DocData][] {
    const coll = this.store.get(this.name);
    return coll ? [...coll.entries()] : [];
  }

  where(field: string, op: string, value: unknown): MockCollectionRef {
    const c = this.clone();

    if (field === DOCUMENT_ID_SENTINEL) {
      if (op === 'in') {
        const vals = value as string[];
        c.filters.push((id) => vals.includes(id));
      } else if (op === '==') {
        c.filters.push((id) => id === value);
      }
    } else {
      if (op === '==') {
        c.filters.push((_, d) => d[field] === value);
      } else if (op === 'in') {
        const vals = value as unknown[];
        c.filters.push((_, d) => vals.includes(d[field]));
      } else if (op === 'array-contains') {
        c.filters.push((_, d) => {
          const arr = d[field];
          return Array.isArray(arr) && arr.includes(value);
        });
      } else if (op === '>=') {
        c.filters.push((_, d) => (d[field] as string) >= (value as string));
      } else if (op === '<=') {
        c.filters.push((_, d) => (d[field] as string) <= (value as string));
      }
    }
    return c;
  }

  orderBy(field: string, direction?: string): MockCollectionRef {
    const c = this.clone();
    c.sortField = field;
    c.sortDir = (direction as 'asc' | 'desc') ?? 'asc';
    return c;
  }

  limit(n: number): MockCollectionRef {
    const c = this.clone();
    c.limitN = n;
    return c;
  }

  doc(id: string): MockDocRef {
    return new MockDocRef(this.store, this.name, id);
  }

  async get(): Promise<MockQuerySnapshot> {
    let entries = this.getEntries();

    for (const f of this.filters) {
      entries = entries.filter(([id, data]) => f(id, data));
    }

    if (this.sortField) {
      const field = this.sortField;
      const dir = this.sortDir === 'desc' ? -1 : 1;
      entries.sort((a, b) => {
        const va = a[1][field];
        const vb = b[1][field];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'string' && typeof vb === 'string')
          return va.localeCompare(vb) * dir;
        return ((va as number) - (vb as number)) * dir;
      });
    }

    if (this.limitN != null) {
      entries = entries.slice(0, this.limitN);
    }

    const docs = entries.map(
      ([id, data]) => new MockDocSnapshot(id, data, this.store, this.name),
    );
    return new MockQuerySnapshot(docs);
  }

  async add(data: DocData): Promise<MockDocRef> {
    let coll = this.store.get(this.name);
    if (!coll) {
      coll = new Map();
      this.store.set(this.name, coll);
    }
    const id = 'auto_' + Math.random().toString(36).slice(2, 10);
    coll.set(id, { ...data });
    return new MockDocRef(this.store, this.name, id);
  }

  private clone(): MockCollectionRef {
    const c = new MockCollectionRef(this.store, this.name);
    c.filters = [...this.filters];
    c.sortField = this.sortField;
    c.sortDir = this.sortDir;
    c.limitN = this.limitN;
    return c;
  }
}

export class MockBatch {
  private ops: Array<() => Promise<void>> = [];

  set(ref: MockDocRef, data: DocData) {
    this.ops.push(() => ref.set(data));
  }

  update(ref: MockDocRef, data: DocData) {
    this.ops.push(() => ref.update(data));
  }

  delete(ref: MockDocRef) {
    this.ops.push(() => ref.delete());
  }

  async commit() {
    for (const op of this.ops) {
      await op();
    }
  }
}

export class MockFirestoreDB {
  private store: Map<string, Map<string, DocData>> = new Map();

  collection(name: string): MockCollectionRef {
    return new MockCollectionRef(this.store, name);
  }

  batch(): MockBatch {
    return new MockBatch();
  }

  seed(collectionName: string, docs: Array<{ id: string; [k: string]: unknown }>) {
    const map = new Map<string, DocData>();
    for (const { id, ...rest } of docs) {
      map.set(id, rest);
    }
    this.store.set(collectionName, map);
  }

  reset() {
    this.store.clear();
  }
}
