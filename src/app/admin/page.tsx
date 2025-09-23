
"use client";
import React, { useState, useEffect } from "react";

interface Target {
  _id?: string;
  name: string;
  type: string;
  description?: string;
  details?: Record<string, unknown>;
  content: string[];
}

export default function AdminPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Target | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "school",
    description: "",
    details: "{}",
    content: "[]"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTargets = async () => {
    const res = await fetch("/api/v2/admin");
    const data: { targets: Target[] } = await res.json();
    setTargets(data.targets);
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const openModal = (target?: Target) => {
    setError("");
    setModalOpen(true);
    if (target) {
      setEditTarget(target);
      setForm({
        name: target.name,
        type: target.type || "school",
        description: target.description || "",
        details: JSON.stringify(target.details || {}, null, 2),
        content: JSON.stringify(target.content || [], null, 2),
      });
    } else {
      setEditTarget(null);
      setForm({
        name: "",
        type: "school",
        description: "",
        details: "{}",
        content: "[]"
      });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
      setEditTarget(null);
      setForm({
        name: "",
        type: "school",
        description: "",
        details: "{}",
        content: "[]"
      });
    setError("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const method = editTarget ? "PUT" : "POST";
      await fetch("/api/v2/admin", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          description: form.description,
          details: JSON.parse(form.details),
          content: JSON.parse(form.content),
        }),
      });
      await fetchTargets();
      closeModal();
    } catch {
      setError("Invalid data. Please check your input.");
    }
    setLoading(false);
  };

  const handleDelete = async (target: Target) => {
    if (!window.confirm(`Delete target '${target.name}'?`)) return;
    setLoading(true);
    await fetch(`/api/v2/admin/${target.name}`, { method: "DELETE" });
    await fetchTargets();
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 border rounded shadow bg-white">
      <h1 className="text-3xl font-bold mb-6 text-center">Admin Dashboard</h1>
      <button
        className="mb-4 bg-green-600 text-white px-4 py-2 rounded font-semibold"
        onClick={() => openModal()}
      >
        Add Target
      </button>
      <div className="overflow-x-auto">
        <table className="w-full border rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-left">Details</th>
              <th className="p-2 text-left">Content</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => (
              <tr key={t._id} className="border-b">
                <td className="p-2 font-semibold">{t.name}</td>
                <td className="p-2">{t.type}</td>
                <td className="p-2">{t.description}</td>
                <td className="p-2">
                  <pre className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-auto">{JSON.stringify(t.details, null, 2)}</pre>
                </td>
                <td className="p-2">
                  <pre className="bg-gray-50 p-2 rounded text-xs max-h-32 overflow-auto">{JSON.stringify(t.content, null, 2)}</pre>
                </td>
                <td className="p-2 flex gap-2">
                  <button
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                    onClick={() => openModal(t)}
                  >Edit</button>
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() => handleDelete(t)}
                  >Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal for Add/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editTarget ? "Edit Target" : "Add Target"}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                className="border p-2 rounded"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Target name"
                required
                disabled={!!editTarget}
              />
              <input
                className="border p-2 rounded"
                name="type"
                value={form.type}
                onChange={handleChange}
                placeholder="Target type (e.g. school, person)"
                required
              />
              <input
                className="border p-2 rounded"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Description"
              />
              <textarea
                className="border p-2 rounded font-mono"
                name="details"
                value={form.details}
                onChange={handleChange}
                placeholder="Details (JSON)"
                rows={4}
                required
              />
              <textarea
                className="border p-2 rounded font-mono"
                name="content"
                value={form.content}
                onChange={handleChange}
                placeholder="Content (JSON array)"
                rows={4}
                required
              />
              {error && <div className="text-red-600">{error}</div>}
              <div className="flex gap-2 mt-2">
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded font-semibold"
                  disabled={loading}
                >
                  {loading ? "Saving..." : editTarget ? "Update" : "Add"}
                </button>
                <button
                  type="button"
                  className="bg-gray-400 text-white px-4 py-2 rounded font-semibold"
                  onClick={closeModal}
                  disabled={loading}
                >Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
