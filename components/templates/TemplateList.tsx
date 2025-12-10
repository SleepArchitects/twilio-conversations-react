"use client";

import { useState } from "react";
import { Button, Card, Dropdown, Modal } from "flowbite-react";
import {
  HiDotsVertical,
  HiPencil,
  HiTrash,
  HiDuplicate,
  HiPlus,
} from "react-icons/hi";
import { type Template } from "@/types/sms";

interface TemplateListProps {
  templates: Template[];
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => Promise<void>;
  onCreate: () => void;
  isLoading?: boolean;
}

export function TemplateList({
  templates,
  onEdit,
  onDelete,
  onCreate,
  isLoading = false,
}: TemplateListProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const handleDeleteClick = (template: Template) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(templateToDelete);
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    // Could add toast notification here
  };

  // We can reuse TemplateSelector for display logic, but we need custom item rendering
  // for the edit/delete actions. However, TemplateSelector is designed for selection.
  // Let's build a custom list view that reuses some patterns but adds management features.

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Message Templates
        </h2>
        <Button onClick={onCreate} color="blue">
          <HiPlus className="mr-2 h-5 w-5" />
          New Template
        </Button>
      </div>

      {/* Reusing TemplateSelector for search and filter UI would be nice, but it controls its own state.
          For now, let's implement a simple list view. */}

      {/* Search and Filter Controls */}
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="welcome">Welcome</option>
          <option value="reminder">Reminder</option>
          <option value="follow-up">Follow-up</option>
          <option value="education">Education</option>
          <option value="general">General</option>
        </select>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="col-span-full text-center text-gray-500">
            Loading templates...
          </p>
        ) : filteredTemplates.length === 0 ? (
          <p className="col-span-full text-center text-gray-500">
            No templates found.
          </p>
        ) : (
          filteredTemplates.map((template) => (
            <Card key={template.id} className="relative">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {template.name}
                  </h3>
                  <div className="mt-1 flex gap-2">
                    <span className="inline-flex items-center rounded bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {template.category}
                    </span>
                    {template.practiceId === null && (
                      <span className="inline-flex items-center rounded bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                        Global
                      </span>
                    )}
                  </div>
                </div>
                <Dropdown
                  inline
                  label=""
                  renderTrigger={() => (
                    <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700">
                      <HiDotsVertical className="h-5 w-5" />
                    </button>
                  )}
                >
                  <Dropdown.Item
                    icon={HiPencil}
                    onClick={() => onEdit(template)}
                  >
                    Edit
                  </Dropdown.Item>
                  <Dropdown.Item
                    icon={HiDuplicate}
                    onClick={() => handleCopyContent(template.content)}
                  >
                    Copy Content
                  </Dropdown.Item>
                  <Dropdown.Item
                    icon={HiTrash}
                    className="text-red-600 dark:text-red-500"
                    onClick={() => handleDeleteClick(template)}
                  >
                    Delete
                  </Dropdown.Item>
                </Dropdown>
              </div>
              <p className="mt-4 line-clamp-3 text-sm text-gray-500 dark:text-gray-400">
                {template.content}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{template.usageCount} uses</span>
                {template.variables.length > 0 && (
                  <span>{template.variables.length} variables</span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        show={deleteModalOpen}
        size="md"
        onClose={() => setDeleteModalOpen(false)}
        popup
      >
        <Modal.Header />
        <Modal.Body>
          <div className="text-center">
            <HiTrash className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
            <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this template?
            </h3>
            <div className="flex justify-center gap-4">
              <Button
                color="failure"
                onClick={handleConfirmDelete}
                isProcessing={isDeleting}
              >
                {"Yes, I'm sure"}
              </Button>
              <Button color="gray" onClick={() => setDeleteModalOpen(false)}>
                No, cancel
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
