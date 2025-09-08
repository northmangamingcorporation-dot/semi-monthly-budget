
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'   // ⚠ This line is required
import { StrictMode } from 'react'

import React, { useEffect, useMemo, useState } from "react";
import { format, getDaysInMonth } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Plus, Calendar, DollarSign, Trash2, Upload, Download, RotateCcw } from "lucide-react";

// -----------------------------
// Types
// -----------------------------

/** @typedef {"fixed"|"variable"|"savings"|"debt"} Category */

/** @typedef {{
 *  id: string,
 *  name: string,
 *  amount: number,
 *  dueDay: number, // 1..31 (use last day when shorter)
 *  category: Category,
 * }} Expense */

/** @typedef {{
 *  paycheckDays: [number, number], // e.g., [1, 16]
 *  netPerPaycheck: number,
 *  extras: number,
 * }} IncomeConfig */

/** @typedef {{
 *  expenses: Expense[],
 *  income: IncomeConfig,
 * }} BudgetState */

// -----------------------------
// Utilities
// -----------------------------

const uid = () => Math.random().toString(36).slice(2, 9);

const CATEGORIES = [
  { id: "fixed", label: "Fixed" },
  { id: "variable", label: "Variable" },
  { id: "savings", label: "Savings/Goals" },
  { id: "debt", label: "Debt" },
];

function clampDay(day, year, monthIndex) {
  const dim = getDaysInMonth(new Date(year, monthIndex, 1));
  return Math.min(Math.max(1, day), dim);
}

function monthKey(d) {
  return format(d, "yyyy-MM");
}

function assignToPaycheck(dueDay, p1, p2, year, monthIndex) {
  const d1 = clampDay(p1, year, monthIndex);
  const d2 = clampDay(p2, year, monthIndex);

  const first = Math.min(d1, d2);
  const second = Math.max(d1, d2);

  if (dueDay > first && dueDay <= second) return 1; // after first → paycheck 1
  if (dueDay > second || dueDay <= first) return 2; // after second → paycheck 2
}


function currency(n) {
  if (Number.isNaN(n)) return "₱0";
  return n.toLocaleString(undefined, { style: "currency", currency: "PHP" });
}

const STORAGE_KEY = "semiMonthlyBudget.v1";

function loadState() /** @returns {BudgetState} */ {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw);
    if (!parsed.income || !Array.isArray(parsed.expenses)) throw new Error("invalid");
    return parsed;
  } catch {
    return {
      income: { paycheckDays: [1, 16], netPerPaycheck: 20000, extras: 0 },
      expenses: [
        { id: uid(), name: "Rent", amount: 10000, dueDay: 1, category: "fixed" },
        { id: uid(), name: "Electric", amount: 2500, dueDay: 6, category: "fixed" },
        { id: uid(), name: "Water", amount: 600, dueDay: 10, category: "fixed" },
        { id: uid(), name: "Groceries", amount: 6000, dueDay: 18, category: "variable" },
        { id: uid(), name: "Mobile Plan", amount: 999, dueDay: 20, category: "fixed" },
        { id: uid(), name: "Debt Snowball", amount: 3000, dueDay: 25, category: "debt" },
        { id: uid(), name: "Emergency Fund", amount: 2000, dueDay: 30, category: "savings" },
      ],
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// -----------------------------
// Components
// -----------------------------

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, right, children }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />} {title}
        </CardTitle>
        <div>{right}</div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PaycheckSummary({
  paycheckIndex,
  totalIncome,
  totalExpenses,
}) {
  const remaining = totalIncome - totalExpenses;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="p-3 rounded-xl bg-muted">
        <div className="text-xs text-muted-foreground">Paycheck</div>
        <div className="text-base font-semibold">#{paycheckIndex}</div>
      </div>
      <div className="p-3 rounded-xl bg-muted">
        <div className="text-xs text-muted-foreground">Income</div>
        <div className="text-base font-semibold">{currency(totalIncome)}</div>
      </div>
      <div className="p-3 rounded-xl bg-muted">
        <div className="text-xs text-muted-foreground">Bills</div>
        <div className="text-base font-semibold">{currency(totalExpenses)}</div>
      </div>
      <div className={`p-3 rounded-xl ${remaining >= 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-rose-50 dark:bg-rose-950"}`}>
        <div className="text-xs text-muted-foreground">Remaining</div>
        <div className={`text-base font-semibold ${remaining < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>{currency(remaining)}</div>
      </div>
    </div>
  );
}

function ExpensesTable({ items, onDelete }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-center">Due Day</TableHead>
          <TableHead className="text-center">Category</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
              No expenses yet. Add one using the button above.
            </TableCell>
          </TableRow>
        )}
        {items.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="font-medium">{e.name}</TableCell>
            <TableCell className="text-right">{currency(e.amount)}</TableCell>
            <TableCell className="text-center">{e.dueDay}</TableCell>
            <TableCell className="text-center">
              <Badge variant="secondary" className="rounded-full">
                {CATEGORIES.find((c) => c.id === e.category)?.label || e.category}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" onClick={() => onDelete(e.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AddExpenseDialog({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [category, setCategory] = useState("fixed");

  function reset() {
    setName("");
    setAmount("");
    setDueDay("1");
    setCategory("fixed");
  }

  function submit() {
    const n = name.trim();
    const a = Number(amount);
    const d = Number(dueDay);
    if (!n || !Number.isFinite(a) || a <= 0 || !Number.isInteger(d)) return;
    onAdd({ id: uid(), name: n, amount: a, dueDay: d, category });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Add expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>Recurring monthly expense, assigned by due date to a paycheck.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Rent" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₱)">
              <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Due day">
              <Input type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} min={1} max={31} />
            </Field>
          </div>
          <Field label="Category">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportExport({ state, setState }) {
  function onExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-${monthKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !parsed.income || !Array.isArray(parsed.expenses)) throw new Error("Invalid file");
        setState(parsed);
      } catch (err) {
        alert("Import failed: " + (err?.message || "Invalid file"));
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex gap-2 items-center">
      <Button variant="outline" onClick={onExport}>
        <Download className="h-4 w-4 mr-2" /> Export JSON
      </Button>
      <Label htmlFor="import-file" className="sr-only">Import JSON</Label>
      <Input id="import-file" type="file" accept="application/json" className="w-52" onChange={onImport} />
      <Button variant="ghost" onClick={() => {
        if (confirm("Reset all data?")) {
          const fresh = loadState();
          setState({ ...fresh, expenses: [] });
        }
      }}>
        <RotateCcw className="h-4 w-4 mr-2" /> Reset
      </Button>
    </div>
  );
}

function DistributionChart({ paycheckTotals }) {
  const data = useMemo(() => {
    return [
      { name: "P1 Bills", value: paycheckTotals.p1Expenses },
      { name: "P1 Leftover", value: Math.max(0, paycheckTotals.p1Income - paycheckTotals.p1Expenses) },
      { name: "P2 Bills", value: paycheckTotals.p2Expenses },
      { name: "P2 Leftover", value: Math.max(0, paycheckTotals.p2Income - paycheckTotals.p2Expenses) },
    ];
  }, [paycheckTotals]);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" data={data} label>
            {data.map((_, idx) => (
              <Cell key={idx} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SemiMonthlyBudgetApp() {
  const [now] = useState(new Date());
  const [state, setState] = useState(loadState);
  const { expenses, income } = state;

  useEffect(() => saveState(state), [state]);

  // Controls: month/year selection to view assignments
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());

  // Computations
  const paycheckDaysClamped = useMemo(() => {
    return [
      clampDay(income.paycheckDays[0], year, monthIndex),
      clampDay(income.paycheckDays[1], year, monthIndex),
    ];
  }, [income.paycheckDays, year, monthIndex]);

  const assigned = useMemo(() => {
    return expenses.map((e) => ({
      ...e,
      paycheck: assignToPaycheck(e.dueDay, paycheckDaysClamped[0], paycheckDaysClamped[1], year, monthIndex),
    }));
  }, [expenses, paycheckDaysClamped, year, monthIndex]);

  const p1Items = assigned.filter((e) => e.paycheck === 1);
  const p2Items = assigned.filter((e) => e.paycheck === 2);
  const p1Total = p1Items.reduce((s, e) => s + e.amount, 0);
  const p2Total = p2Items.reduce((s, e) => s + e.amount, 0);
  const p1Income = income.netPerPaycheck + (income.extras > 0 ? income.extras / 2 : 0);
  const p2Income = income.netPerPaycheck + (income.extras > 0 ? income.extras / 2 : 0);

  const paycheckTotals = {
    p1Income,
    p2Income,
    p1Expenses: p1Total,
    p2Expenses: p2Total,
  };

  function updateIncome(part) {
    setState((s) => ({ ...s, income: { ...s.income, ...part } }));
  }

  function addExpense(exp) {
    setState((s) => ({ ...s, expenses: [...s.expenses, exp] }));
  }

  function deleteExpense(id) {
    setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
  }

  const dim = getDaysInMonth(new Date(year, monthIndex, 1));
  const days = Array.from({ length: dim }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Semi‑Monthly Budget</h1>
          <p className="text-sm text-muted-foreground">Plan each paycheck around your due dates. Data is saved in your browser.</p>
        </div>
        <ImportExport state={state} setState={setState} />
      </div>

      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* PLAN TAB */}
        <TabsContent value="plan" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title="Income & Paydays" icon={DollarSign} right={null}>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Net per paycheck (₱)">
                    <Input
                      type="number"
                      value={income.netPerPaycheck}
                      onChange={(e) => updateIncome({ netPerPaycheck: Number(e.target.value) || 0 })}
                    />
                  </Field>
                  <Field label="Monthly extras (₱)" hint="Side gigs, bonuses; split across paychecks">
                    <Input
                      type="number"
                      value={income.extras}
                      onChange={(e) => updateIncome({ extras: Number(e.target.value) || 0 })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Payday #1 (day)">
                    <Input
                      type="number"
                      value={income.paycheckDays[0]}
                      min={1}
                      max={31}
                      onChange={(e) => updateIncome({ paycheckDays: [Number(e.target.value) || 1, income.paycheckDays[1]] })}
                    />
                  </Field>
                  <Field label="Payday #2 (day)">
                    <Input
                      type="number"
                      value={income.paycheckDays[1]}
                      min={1}
                      max={31}
                      onChange={(e) => updateIncome({ paycheckDays: [income.paycheckDays[0], Number(e.target.value) || 1] })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="View Year">
                    <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())} />
                  </Field>
                  <Field label="View Month">
                    <Select value={String(monthIndex)} onValueChange={(v) => setMonthIndex(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, m) => (
                          <SelectItem key={m} value={String(m)}>
                            {format(new Date(2025, m, 1), "LLLL")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="This Month at a Glance" icon={Calendar}>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="rounded-full">Payday #{paycheckDaysClamped[0] <= paycheckDaysClamped[1] ? 1 : 2}</Badge>
                  <span>{format(new Date(year, monthIndex, paycheckDaysClamped[0]), "PP")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary" className="rounded-full">Payday #{paycheckDaysClamped[0] <= paycheckDaysClamped[1] ? 2 : 1}</Badge>
                  <span>{format(new Date(year, monthIndex, paycheckDaysClamped[1]), "PP")}</span>
                </div>

                <div className="mt-2">
                  <div className="grid grid-cols-12 gap-1 text-xs text-muted-foreground">
                    {days.map((d) => {
                      const isP1 = d === paycheckDaysClamped[0];
                      const isP2 = d === paycheckDaysClamped[1];
                      const hasBill = assigned.some((e) => e.dueDay === d);
                      return (
                        <div key={d} className="flex flex-col items-center">
                          <div className={`w-full h-8 rounded ${isP1 ? "bg-emerald-500/20" : isP2 ? "bg-blue-500/20" : hasBill ? "bg-muted" : "bg-transparent"} border border-border flex items-center justify-center`}>{d}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-500/30 border" /> Payday #1</span>
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500/30 border" /> Payday #2</span>
                    <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded bg-muted border" /> Bill due</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Summary" icon={DollarSign}>
              <div className="space-y-4">
                <PaycheckSummary paycheckIndex={1} totalIncome={p1Income} totalExpenses={p1Total} />
                <PaycheckSummary paycheckIndex={2} totalIncome={p2Income} totalExpenses={p2Total} />
                <DistributionChart paycheckTotals={paycheckTotals} />
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Bills After Payday #1" icon={Calendar} right={<Badge variant="outline">Total: {currency(p1Total)}</Badge>}>
              <ExpensesTable items={p1Items} onDelete={deleteExpense} />
            </Section>

            <Section title="Bills After Payday #2" icon={Calendar} right={<Badge variant="outline">Total: {currency(p2Total)}</Badge>}>
              <ExpensesTable items={p2Items} onDelete={deleteExpense} />
            </Section>
          </div>
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses" className="space-y-6">
          <Section
            title="Recurring Expenses"
            icon={Plus}
            right={<AddExpenseDialog onAdd={addExpense} />}
          >
            <ExpensesTable items={expenses} onDelete={deleteExpense} />
          </Section>
        </TabsContent>

        {/* REPORTS TAB */}
        <TabsContent value="reports" className="space-y-6">
          <Section title="Category Breakdown" icon={DollarSign}>
            <CategoryBreakdown expenses={expenses} />
          </Section>
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-muted-foreground text-center py-4">
        Built for semi‑monthly budgeting • {format(now, "PPP")} • Data stored locally
      </footer>
    </div>
  );
}

function CategoryBreakdown({ expenses }) {
  const byCat = useMemo(() => {
    const m = new Map();
    for (const e of expenses) {
      m.set(e.category, (m.get(e.category) || 0) + e.amount);
    }
    return Array.from(m.entries()).map(([k, v]) => ({ name: CATEGORIES.find((c) => c.id === k)?.label || k, value: v }));
  }, [expenses]);

  if (byCat.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" data={byCat} nameKey="name" label>
            {byCat.map((_, idx) => (
              <Cell key={idx} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

