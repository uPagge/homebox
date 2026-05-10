import { ref, type Ref } from "vue";
import type { LocationSummary, TreeItem } from "~~/lib/api/types/data-contracts";

type FlatLocationNode = {
  id: string;
  name: string;
  parentId: string | null;
  ancestors: LocationSummary[];
  pathString: string;
  hasChildren: boolean;
};

const PATH_SEPARATOR = " › ";

const tree = ref<TreeItem[] | null>(null);
const byId: Ref<Map<string, FlatLocationNode>> = ref(new Map());
const loading = ref(false);
let pending: Promise<void> | null = null;

function makeSummary(node: TreeItem): LocationSummary {
  return {
    id: node.id,
    name: node.name,
    description: "",
    createdAt: "",
    updatedAt: "",
  };
}

function flatten(nodes: TreeItem[]): Map<string, FlatLocationNode> {
  const out = new Map<string, FlatLocationNode>();

  function walk(node: TreeItem, ancestors: LocationSummary[], parentId: string | null) {
    const flat: FlatLocationNode = {
      id: node.id,
      name: node.name,
      parentId,
      ancestors,
      pathString: [...ancestors.map(a => a.name), node.name].join(PATH_SEPARATOR),
      hasChildren: (node.children?.length ?? 0) > 0,
    };
    out.set(node.id, flat);

    const childAncestors: LocationSummary[] = [...ancestors, makeSummary(node)];
    for (const child of node.children ?? []) {
      walk(child, childAncestors, node.id);
    }
  }

  for (const root of nodes) {
    walk(root, [], null);
  }

  return out;
}

async function ensureLoaded() {
  if (tree.value) return;
  if (pending) return pending;

  loading.value = true;
  const api = useUserApi();
  pending = (async () => {
    try {
      const resp = await api.locations.getTree({ withItems: false });
      if (resp.data) {
        tree.value = resp.data;
        byId.value = flatten(resp.data);
      } else if (resp.error) {
        console.warn("[useLocationTree] tree fetch returned error", resp.error);
      }
    } catch (err) {
      console.warn("[useLocationTree] tree fetch threw", err);
    } finally {
      loading.value = false;
      pending = null;
    }
  })();
  return pending;
}

export function useLocationTree() {
  void ensureLoaded();

  function getNode(id: string | undefined | null): FlatLocationNode | null {
    if (!id) return null;
    return byId.value.get(id) ?? null;
  }

  function getPath(id: string | undefined | null): LocationSummary[] | null {
    const node = getNode(id);
    if (!node) return null;
    return [
      ...node.ancestors,
      {
        id: node.id,
        name: node.name,
        description: "",
        createdAt: "",
        updatedAt: "",
      },
    ];
  }

  function getPathString(id: string | undefined | null, sep = PATH_SEPARATOR): string | null {
    const node = getNode(id);
    if (!node) return null;
    if (sep === PATH_SEPARATOR) return node.pathString;
    return node.pathString.split(PATH_SEPARATOR).join(sep);
  }

  function hasChildren(id: string | undefined | null): boolean {
    return getNode(id)?.hasChildren ?? false;
  }

  // Returns rootId itself plus every descendant. Empty array if rootId is
  // unknown (e.g. tree not loaded yet) — caller should fall back.
  function getDescendantIds(rootId: string | undefined | null): string[] {
    if (!rootId) return [];
    const out: string[] = [];
    for (const node of byId.value.values()) {
      if (node.id === rootId || node.ancestors.some(a => a.id === rootId)) {
        out.push(node.id);
      }
    }
    return out;
  }

  // Resolves once the tree has been fetched (success or failure). Lets callers
  // wait before computing path / descendants on first render.
  function ready(): Promise<void> {
    return ensureLoaded() ?? Promise.resolve();
  }

  function invalidate() {
    tree.value = null;
    byId.value = new Map();
    pending = null;
    void ensureLoaded();
  }

  return {
    loading,
    getPath,
    getPathString,
    hasChildren,
    getDescendantIds,
    ready,
    invalidate,
  };
}
