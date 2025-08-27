"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

/* --------------------- Types --------------------- */
type Category = {
  id: string;
  name: string;
  limit: number; // monthly limit (applies to selected month’s spending)
};

type Entry = {
  id: string;
  type: "income" | "expense";
  desc: string;
  amount: number;        // positive
  date: string;          // YYYY-MM-DD
  categoryId?: string;   // for expenses
};

/* ------------------ Helpers ------------------ */
const ym = (d: string) => d.slice(0, 7); // "YYYY-MM"
const todayYM = () => new Date().toISOString().slice(0, 7);

/* ------------------ Component ------------------ */
export default function Page() {
  /* ---------- State ---------- */
  const [month, setMonth] = useState<string>(todayYM());

  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  // Income form
  const [iDesc, setIDesc] = useState("");
  const [iAmt, setIAmt] = useState<number | "">("");
  const [iDate, setIDate] = useState<string>("");

  // Expense form
  const [eDesc, setEDesc] = useState("");
  const [eAmt, setEAmt] = useState<number | "">("");
  const [eDate, setEDate] = useState<string>("");
  const [eCatId, setECatId] = useState<string>("");

  // Edit states
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Category form
  const [catName, setCatName] = useState("");
  const [catLimit, setCatLimit] = useState<number | "">("");

  /* ---------- Persistence ---------- */
  useEffect(() => {
    try {
      const cs = JSON.parse(localStorage.getItem("pf_categories") || "[]");
      const es = JSON.parse(localStorage.getItem("pf_entries") || "[]");

      // Back-compat: merge old separate income/expenses if present
      const oldI = JSON.parse(localStorage.getItem("pf_income") || "[]");
      const oldE = JSON.parse(localStorage.getItem("pf_expenses") || "[]");
      const merged: Entry[] =
        es.length > 0
          ? es
          : [
              ...oldI.map((x: any) => ({ ...x, type: "income" as const })),
              ...oldE.map((x: any) => ({ ...x, type: "expense" as const })),
            ];

      setCategories(cs);
      setEntries(merged);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("pf_categories", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("pf_entries", JSON.stringify(entries));
  }, [entries]);

  /* ---------- Derived (for selected month) ---------- */
  const monthEntries = useMemo(
    () => entries.filter(e => ym(e.date) === month),
    [entries, month]
  );

  const totalIncome = useMemo(
    () => monthEntries.filter(e => e.type === "income").reduce((s, x) => s + x.amount, 0),
    [monthEntries]
  );

  const totalExpenses = useMemo(
    () => monthEntries.filter(e => e.type === "expense").reduce((s, x) => s + x.amount, 0),
    [monthEntries]
  );

  const net = totalIncome - totalExpenses;

  // Per-category spending
  const catSpend = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) map.set(c.id, 0);
    for (const e of monthEntries) {
      if (e.type === "expense" && e.categoryId && map.has(e.categoryId)) {
        map.set(e.categoryId, (map.get(e.categoryId) || 0) + e.amount);
      }
    }
    return map; // categoryId -> spent
  }, [monthEntries, categories]);

  /* ---------- CRUD: Categories ---------- */
  const addOrUpdateCategory = () => {
    if (!catName || !catLimit) return;
    if (editingCatId) {
      setCategories(prev =>
        prev.map(c => (c.id === editingCatId ? { ...c, name: catName, limit: Number(catLimit) } : c))
      );
      setEditingCatId(null);
    } else {
      setCategories(prev => [{ id: crypto.randomUUID(), name: catName, limit: Number(catLimit) }, ...prev]);
    }
    setCatName("");
    setCatLimit("");
  };

  const editCategory = (c: Category) => {
    setEditingCatId(c.id);
    setCatName(c.name);
    setCatLimit(c.limit);
  };

  const deleteCategory = (id: string) => {
    // Also remove *expense* entries for this category for data consistency
    setEntries(prev => prev.filter(e => !(e.type === "expense" && e.categoryId === id)));
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  /* ---------- CRUD: Entries ---------- */
  const addOrUpdateIncome = () => {
    if (!iDesc || !iAmt || !iDate) return;
    if (editingEntryId) {
      setEntries(prev =>
        prev.map(e => (e.id === editingEntryId ? { ...e, type: "income", desc: iDesc, amount: Number(iAmt), date: iDate, categoryId: undefined } : e))
      );
      setEditingEntryId(null);
    } else {
      setEntries(prev => [{ id: crypto.randomUUID(), type: "income", desc: iDesc, amount: Number(iAmt), date: iDate }, ...prev]);
    }
    setIDesc(""); setIAmt(""); setIDate("");
  };

  const addOrUpdateExpense = () => {
    if (!eDesc || !eAmt || !eDate || !eCatId) return;
    if (editingEntryId) {
      setEntries(prev =>
        prev.map(e => (e.id === editingEntryId ? { ...e, type: "expense", desc: eDesc, amount: Number(eAmt), date: eDate, categoryId: eCatId } : e))
      );
      setEditingEntryId(null);
    } else {
      setEntries(prev => [{ id: crypto.randomUUID(), type: "expense", desc: eDesc, amount: Number(eAmt), date: eDate, categoryId: eCatId }, ...prev]);
    }
    setEDesc(""); setEAmt(""); setEDate(""); setECatId("");
  };

  const startEditEntry = (entry: Entry) => {
    setEditingEntryId(entry.id);
    if (entry.type === "income") {
      setIDesc(entry.desc);
      setIAmt(entry.amount);
      setIDate(entry.date);
    } else {
      setEDesc(entry.desc);
      setEAmt(entry.amount);
      setEDate(entry.date);
      setECatId(entry.categoryId || "");
    }
  };

  const deleteEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  /* ---------- UI ---------- */
  return (
    <div className={styles.wrap}>
      {/* Header & Month Filter */}
      <div className={styles.header}>
        <div className={styles.title}>Personal Finance — Dashboard</div>
        <div className={styles.filters}>
          <label>
            Month&nbsp;
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ background: "#0f141d", border: "1px solid var(--border)", color: "var(--text)", padding: 8, borderRadius: 8 }}
            />
          </label>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpis}>
        <div className={styles.card}>
          <h4>Total Income</h4>
          <div className={`${styles.big} ${styles.income}`}>${totalIncome.toLocaleString()}</div>
        </div>
        <div className={styles.card}>
          <h4>Total Expenses</h4>
          <div className={`${styles.big} ${styles.expense}`}>${totalExpenses.toLocaleString()}</div>
        </div>
        <div className={styles.card}>
          <h4>Net</h4>
          <div className={`${styles.big} ${net >= 0 ? styles.netPos : styles.netNeg}`}>${net.toLocaleString()}</div>
        </div>
      </div>

      {/* Categories (limits + spend) */}
      <div className={styles.panel}>
        <h3>Expense Categories & Limits</h3>
        <div className={styles.catForm}>
          <input placeholder="Category name" value={catName} onChange={e=>setCatName(e.target.value)} />
          <input type="number" placeholder="Monthly limit" value={catLimit} onChange={e=>setCatLimit(e.target.value===""?"":Number(e.target.value))} />
          <button className={styles.btn} onClick={addOrUpdateCategory}>{editingCatId ? "Save" : "Add"}</button>
        </div>

        <div className={styles.catGrid}>
          {categories.length===0 && <div className={styles.empty}>No categories yet. Add your first limit above.</div>}
          {categories.map(c => {
            const spent = catSpend.get(c.id) || 0;
            const pct = Math.min(100, Math.round((spent / Math.max(1, c.limit)) * 100));
            const over = spent > c.limit;
            return (
              <div key={c.id} className={styles.catCard}>
                <div className={styles.catHead}>
                  <div className={styles.catName}>{c.name}</div>
                  <div className={styles.limit}>Limit: ${c.limit.toLocaleString()}</div>
                </div>
                <div className={styles.progressWrap}>
                  <div className={`${styles.progressFill} ${over ? styles.over : ""}`} style={{ width: `${pct}%` }} />
                </div>
                <div className={styles.catFooter}>
                  <div>Spent: ${spent.toLocaleString()}</div>
                  <div>Remaining: ${(c.limit - spent).toLocaleString()}</div>
                </div>
                <div className={styles.catBtns}>
                  <button className={styles.btn} onClick={()=>editCategory(c)}>Edit</button>
                  <button className={`${styles.btn} ${styles.warn}`} onClick={()=>deleteCategory(c.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two columns: Income | Expenses */}
      <div className={styles.columns}>
        {/* Income */}
        <section className={styles.panel}>
          <h3>Income</h3>
          <div className={`${styles.form} ${styles.nocat}`}>
            <input placeholder="Description" value={iDesc} onChange={e=>setIDesc(e.target.value)} />
            <input type="number" placeholder="Amount" value={iAmt} onChange={e=>setIAmt(e.target.value===""?"":Number(e.target.value))} />
            <input type="date" value={iDate} onChange={e=>setIDate(e.target.value)} />
            <div />
            <button onClick={addOrUpdateIncome}>{editingEntryId ? "Save" : "Add"}</button>
          </div>

          <div className={styles.list}>
            {monthEntries.filter(e=>e.type==="income").length===0 && <div className={styles.empty}>No income this month.</div>}
            {monthEntries.filter(e=>e.type==="income").map(item => (
              <div key={item.id} className={styles.row}>
                <div>
                  <div>{item.desc}</div>
                  <div className={styles.badge}>Income</div>
                </div>
                <div className={`${styles.amount} ${styles.income}`}>+${item.amount.toLocaleString()}</div>
                <div className={styles.badge}>{item.date}</div>
                <div />
                <div className={styles.actions}>
                  <button className={styles.btn} onClick={()=>startEditEntry(item)}>Edit</button>
                  <button className={`${styles.btn} ${styles.warn}`} onClick={()=>deleteEntry(item.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Expenses */}
        <section className={styles.panel}>
          <h3>Expenses</h3>
          <div className={styles.form}>
            <input placeholder="Description" value={eDesc} onChange={e=>setEDesc(e.target.value)} />
            <input type="number" placeholder="Amount" value={eAmt} onChange={e=>setEAmt(e.target.value===""?"":Number(e.target.value))} />
            <input type="date" value={eDate} onChange={e=>setEDate(e.target.value)} />
            <select value={eCatId} onChange={e=>setECatId(e.target.value)}>
              <option value="" disabled>Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={addOrUpdateExpense}>{editingEntryId ? "Save" : "Add"}</button>
          </div>

          <div className={styles.list}>
            {monthEntries.filter(e=>e.type==="expense").length===0 && <div className={styles.empty}>No expenses this month.</div>}
            {monthEntries.filter(e=>e.type==="expense").map(item => {
              const cat = categories.find(c => c.id === item.categoryId);
              return (
                <div key={item.id} className={styles.row}>
                  <div>
                    <div>{item.desc}</div>
                    <div className={styles.badge}>{cat ? cat.name : "—"}</div>
                  </div>
                  <div className={`${styles.amount} ${styles.expense}`}>-${item.amount.toLocaleString()}</div>
                  <div className={styles.badge}>{item.date}</div>
                  <div />
                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={()=>startEditEntry(item)}>Edit</button>
                    <button className={`${styles.btn} ${styles.warn}`} onClick={()=>deleteEntry(item.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
