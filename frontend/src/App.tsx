import { useEffect, useState } from "react";
import "./App.css";

type MenuItem = {
  id: number;
  title: string;
  parent_id: number | null;
  children: MenuItem[];
};

function App() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number[]>([2, 5, 6]);
  const [search, setSearch] = useState("");
  const [newMenu, setNewMenu] = useState("");
  const [newParentId, setNewParentId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    async function fetchMenus() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("http://localhost:8080/api/menus");

        if (!response.ok) {
          throw new Error("Failed to fetch menus.");
        }

        const data: MenuItem[] = await response.json();
        setMenus(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred.",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchMenus();
  }, []);

  async function addMenu() {
    const title = newMenu.trim();

    if (!title) {
      setMessage("Please enter a menu name first.");
      return;
    }

    try {
      setMessage("");

      const response = await fetch("http://localhost:8080/api/menus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          parent_id: newParentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to add menu.");
      }

      const refreshedResponse = await fetch("http://localhost:8080/api/menus");

      if (!refreshedResponse.ok) {
        throw new Error(
          "Menu was added, but the menu list could not be refreshed.",
        );
      }

      const refreshedMenus: MenuItem[] = await refreshedResponse.json();

      setMenus(refreshedMenus);
      setNewMenu("");
      setNewParentId(null);
      setMessage(`"${title}" was added successfully.`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }
  }

  function deleteMenu(items: MenuItem[], id: number): MenuItem[] {
    return items
      .filter((item) => item.id !== id)
      .map((item) => ({
        ...item,
        children: deleteMenu(item.children, id),
      }));
  }

  async function removeMenu(id: number, title: string) {
    try {
      setMessage("");

      const response = await fetch(`http://localhost:8080/api/menus/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to delete menu.");
      }

      setMenus((current) => deleteMenu(current, id));
      setMessage(`"${title}" was deleted successfully.`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }
  }

  async function updateMenu(id: number) {
    const title = editingTitle.trim();

    if (!title) {
      setMessage("Please enter a menu name first.");
      return;
    }

    try {
      setMessage("");

      const response = await fetch(`http://localhost:8080/api/menus/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to update menu.");
      }

      setMenus((current) => updateMenuTitle(current, id, title));

      setEditingId(null);
      setEditingTitle("");
      setMessage(`"${title}" was updated successfully.`);
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    }
  }

  function toggleMenu(id: number) {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id],
    );
  }

  function renderMenus(items: MenuItem[], depth = 0) {
    return items.map((item) => {
      const hasChildren = item.children.length > 0;
      const isExpanded = expanded.includes(item.id);
      const matchesSearch = item.title
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const visibleChildren = search.trim()
        ? item.children.filter(
            (child) =>
              child.title.toLowerCase().includes(search.trim().toLowerCase()) ||
              hasMatchingDescendant(child, search),
          )
        : item.children;

      if (search.trim() && !matchesSearch && visibleChildren.length === 0) {
        return null;
      }

      return (
        <div key={item.id} className="menu-branch">
          <div
            className={`menu-row ${matchesSearch && search.trim() ? "search-match" : ""}`}
            style={{ paddingLeft: `${16 + depth * 28}px` }}
          >
            <button
              className="tree-toggle"
              onClick={() => toggleMenu(item.id)}
              aria-label={isExpanded ? "Collapse menu" : "Expand menu"}
              disabled={!hasChildren}
            >
              {hasChildren ? (isExpanded || search.trim() ? "⌄" : "›") : "·"}
            </button>

            <span className="menu-symbol">{hasChildren ? "📁" : "📄"}</span>

            {editingId === item.id ? (
              <input
                className="menu-edit-input"
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                aria-label={`Edit ${item.title}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    updateMenu(item.id);
                  }

                  if (event.key === "Escape") {
                    setEditingId(null);
                    setEditingTitle("");
                  }
                }}
              />
            ) : (
              <span className="menu-title">{item.title}</span>
            )}

            <span className="menu-level">
              {hasChildren ? `${item.children.length} items` : "Menu"}
            </span>

            {editingId === item.id ? (
              <>
                <button
                  className="secondary-button"
                  onClick={() => updateMenu(item.id)}
                >
                  Save
                </button>

                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditingId(null);
                    setEditingTitle("");
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="icon-button edit-button"
                onClick={() => {
                  setEditingId(item.id);
                  setEditingTitle(item.title);
                  setMessage("");
                }}
                aria-label={`Edit ${item.title}`}
                title={`Edit ${item.title}`}
              >
                ✎
              </button>
            )}

            <button
              className="delete-button"
              onClick={() => removeMenu(item.id, item.title)}
              aria-label={`Delete ${item.title}`}
              title={`Delete ${item.title}`}
            >
              ×
            </button>
          </div>

          {hasChildren && (isExpanded || search.trim()) && (
            <div className="menu-children">
              {renderMenus(visibleChildren, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  }

  function hasMatchingDescendant(item: MenuItem, query: string): boolean {
    const normalized = query.trim().toLowerCase();
    return (
      item.title.toLowerCase().includes(normalized) ||
      item.children.some((child) => hasMatchingDescendant(child, query))
    );
  }

  function expandAll(items: MenuItem[]) {
    setExpanded((current) => [
      ...new Set([
        ...current,
        ...items.flatMap((item) => [item.id, ...getAllIds(item.children)]),
      ]),
    ]);
  }

  function getAllIds(items: MenuItem[]): number[] {
    return items.flatMap((item) => [item.id, ...getAllIds(item.children)]);
  }

  function collapseAll() {
    setExpanded([]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>
          <div>
            <strong>NeysaTree</strong>
            <span>MENU WORKSPACE</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <div className="sidebar-link active">
          <span>☷</span> Menu Management
        </div>
        <div className="sidebar-link">
          <span>⚙</span> Settings
        </div>

        <div className="sidebar-bottom">
          <div className="avatar">N</div>
          <div className="profile">
            <strong>Administrator</strong>
            <span>Workspace admin</span>
          </div>
          <span className="profile-dots">···</span>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <span className="breadcrumb">Workspace / Menu Management</span>
          <span className="status">
            <span /> System ready
          </span>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">CONFIGURATION</div>
              <h1>Menu Management</h1>
              <p>Organize and manage your application menu structure.</p>
            </div>
            <div className="heading-icon">☷</div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">TOTAL MENUS</span>
              <strong>{countMenus(menus)}</strong>
              <span className="stat-note">Across all levels</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">ROOT MENUS</span>
              <strong>{menus.length}</strong>
              <span className="stat-note">Top-level entries</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">NESTED MENUS</span>
              <strong>{countMenus(menus) - menus.length}</strong>
              <span className="stat-note">Child entries</span>
            </div>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Menu Structure</h2>
                <p>View and manage your hierarchical navigation.</p>
              </div>
              <span className="count-badge">{countMenus(menus)} menus</span>
            </div>

            <div className="toolbar">
              <label className="search-box">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search menus..."
                  aria-label="Search menus"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </label>

              <div className="toolbar-actions">
                <button
                  className="secondary-button"
                  onClick={() => expandAll(menus)}
                >
                  Expand all
                </button>
                <button className="secondary-button" onClick={collapseAll}>
                  Collapse all
                </button>
              </div>
            </div>

            <div className="tree-header">
              <span>MENU NAME</span>
              <span>ACTIONS</span>
            </div>

            <div className="tree-list">
              {loading ? (
                <div className="empty-state">
                  <strong>Loading menus...</strong>
                </div>
              ) : error ? (
                <div className="no-results">{error}</div>
              ) : menus.length === 0 ? (
                <div className="empty-state">
                  <span>☷</span>
                  <strong>No menus yet</strong>
                  <p>Add your first menu using the form below.</p>
                </div>
              ) : (
                renderMenus(menus)
              )}

              {search.trim() &&
                !menus.some(
                  (item) =>
                    item.title
                      .toLowerCase()
                      .includes(search.trim().toLowerCase()) ||
                    hasMatchingDescendant(item, search),
                ) && (
                  <div className="no-results">
                    No menus found for "{search}".
                  </div>
                )}
            </div>

            <div className="tree-footer">
              <span>Showing {countMenus(menus)} menu entries</span>
              <span>Nested hierarchy enabled</span>
            </div>
          </section>

          <section className="panel add-panel">
            <div className="panel-heading">
              <div>
                <h2>Add Menu</h2>
                <p>Create a root menu or a nested menu entry.</p>
              </div>
              <span className="add-icon">＋</span>
            </div>

            <form
              className="add-form"
              onSubmit={(event) => {
                event.preventDefault();
                addMenu();
              }}
            >
              <label htmlFor="menu-parent">Parent Menu</label>
              <select
                id="menu-parent"
                value={newParentId ?? ""}
                onChange={(event) =>
                  setNewParentId(
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              >
                <option value="">None (Root Menu)</option>
                {getAllMenus(menus).map((menu) => (
                  <option key={menu.id} value={menu.id}>
                    {menu.title}
                  </option>
                ))}
              </select>

              <label htmlFor="menu-name">Menu name</label>
              <div className="add-input-row">
                <input
                  id="menu-name"
                  value={newMenu}
                  onChange={(event) => setNewMenu(event.target.value)}
                  placeholder="e.g. Customer Support"
                />
                <button className="primary-button" type="submit">
                  + Add Menu
                </button>
              </div>
              {message && <p className="feedback">{message}</p>}
            </form>
          </section>

          <footer className="page-footer">
            <span>
              NeysaTree <span className="footer-dot">•</span> Menu Management
            </span>
            <span>Designed by Neysa · Menu Management System </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

function updateMenuTitle(
  items: MenuItem[],
  id: number,
  title: string,
): MenuItem[] {
  return items.map((item) => ({
    ...item,
    title: item.id === id ? title : item.title,
    children: updateMenuTitle(item.children, id, title),
  }));
}

function getAllMenus(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => [item, ...getAllMenus(item.children)]);
}

function countMenus(items: MenuItem[]): number {
  return items.reduce(
    (total, item) => total + 1 + countMenus(item.children),
    0,
  );
}

export default App;
