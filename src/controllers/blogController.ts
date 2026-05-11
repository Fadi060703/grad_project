// controllers/blogs.ts

import { Request, Response } from "express";
import {
  createBlogSchema,
  getBlogsSchema,
  updateBlogSchema,
} from "../validators/blog";
import { prisma } from "../lib/prisma";
import { createListHandler } from "../lib/express-prisma-query";
import { z } from "zod";

export const getAllBlogs = createListHandler({
  prisma: prisma.blog,

  allowedSortFields: ["id", "title", "created_at", "updated_at"],

  fieldTypes: {
    id: "number",
    title: "text",
    content: "text",
    image: "text",
    created_at: "date",
    updated_at: "date",
  },

  searchableFields: ["title", "content"],

  findManyArgs: {
    select: {
      id: true,
      title: true,
      content: true,
      image: true,
      created_at: true,
      updated_at: true,
    },
  } as any,

  mapResult: ({ data }) => z.array(getBlogsSchema).parse(data),
});

export const getBlogById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const blog = await prisma.blog.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const parsed = getBlogsSchema.parse(blog);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(400).json({ error: err });
  }
};

export const createBlog = async (req: Request, res: Response) => {
  try {
    const data = createBlogSchema.parse(req.body);

    const created = await prisma.blog.create({
      data: {
        title: data.title,
        content: data.content,
        image: data.image ?? null,
      },
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Create blog error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateBlog = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateBlogSchema.parse(req.body);

    const existingBlog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const updateData: {
      title?: string;
      content?: string;
      image?: string | null;
    } = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.image !== undefined) updateData.image = data.image;

    const updated = await prisma.blog.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
        created_at: true,
        updated_at: true,
      },
    });

    return res.status(200).json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Update blog error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existingBlog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!existingBlog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    const deleted = await prisma.blog.delete({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        image: true,
      },
    });

    return res.status(200).json(deleted);
  } catch (err) {
    console.error("Delete blog error:", err);
    return res.status(400).json({ error: err });
  }
};
