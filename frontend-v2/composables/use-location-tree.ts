import { ref, type Ref } from "vue";
import type { LocationSummary, TreeItem } from "~~/lib/api/types/data-contracts";

export type FlatLocationNode = {
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
      }
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

  function invalidate() {
    tree.value = null;
    byId.value = new Map();
    pending = null;
    void ensureLoaded();
  }

  return {
    loading,
    getNode,
    getPath,
    getPathString,
    hasChildren,
    invalidate,
  };
}
