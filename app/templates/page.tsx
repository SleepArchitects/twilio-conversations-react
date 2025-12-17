"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Modal } from "flowbite-react";
import { HiPlus, HiArrowLeft } from "react-icons/hi";
import { useTemplates } from "@/hooks/useTemplates";
import { PageHeader } from "@/components/layout/PageHeader";
import { TemplateList } from "@/components/templates/TemplateList";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { type Template } from "@/types/sms";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function TemplatesPage() {
  const { templates, isLoading, refresh } = useTemplates();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(
    undefined,
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleDelete = async (template: Template) => {
    try {
      await api.delete(`/api/outreach/templates/${template.id}`);
      toast.success("Template deleted successfully");
      refresh();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleSave = async (data: {
    name: string;
    category: string;
    content: string;
  }) => {
    setIsSaving(true);
    try {
      // Extract variables from content
      const regex = /\{\{(\w+)\}\}/g;
      const matches = [...data.content.matchAll(regex)];
      const variables = Array.from(new Set(matches.map((m) => m[1])));

      if (editingTemplate) {
        await api.patch(`/api/outreach/templates/${editingTemplate.id}`, {
          ...data,
          variables,
        });
        toast.success("Template updated successfully");
      } else {
        await api.post("/api/outreach/templates", {
          name: data.name,
          body: data.content, // API expects body, not content
          category: data.category,
          variables,
          isGlobal: false, // Default to private templates for now
        });
        toast.success("Template created successfully");
      }
      setEditorOpen(false);
      refresh();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <PageHeader
        title="Message Templates"
        subtitle="Manage SMS templates"
        className="px-4"
      >
        <div className="flex items-center gap-4">
          <Link href="/conversations">
            <Button color="gray" size="sm">
              <HiArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          {/* Mobile create button */}
          <div className="sm:hidden">
            <Button onClick={handleCreate} color="blue" size="sm">
              <HiPlus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="flex-1 overflow-auto p-4">
        <TemplateList
          templates={templates}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={handleCreate}
          isLoading={isLoading}
        />
      </div>

      <Modal
        show={editorOpen}
        size="2xl"
        onClose={() => setEditorOpen(false)}
        popup
      >
        <Modal.Header>
          {editingTemplate ? "Edit Template" : "Create Template"}
        </Modal.Header>
        <Modal.Body>
          <TemplateEditor
            template={editingTemplate}
            onSave={handleSave}
            onCancel={() => setEditorOpen(false)}
            isSaving={isSaving}
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
