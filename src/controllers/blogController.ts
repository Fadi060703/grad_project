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
import { asyncHandler } from "../utils/asyncHandler";
import { BadRequestError, NotFoundError } from "../errors";

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

export const getBlogById = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid blog ID');
  }

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
    throw new NotFoundError('Blog');
  }

  const parsed = getBlogsSchema.parse(blog);
  
  return res.status(200).json({
    success: true,
    data: parsed
  });
});

export const createBlog = asyncHandler(async (req: Request, res: Response) => {
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

  return res.status(201).json({
    success: true,
    message: 'Blog created successfully',
    data: created
  });
});

export const updateBlog = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid blog ID');
  }
  
  const data = updateBlogSchema.parse(req.body);

  const existingBlog = await prisma.blog.findUnique({
    where: { id },
  });

  if (!existingBlog) {
    throw new NotFoundError('Blog');
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

  return res.status(200).json({
    success: true,
    message: 'Blog updated successfully',
    data: updated
  });
});

export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  
  if (isNaN(id)) {
    throw new BadRequestError('Invalid blog ID');
  }

  const existingBlog = await prisma.blog.findUnique({
    where: { id },
  });

  if (!existingBlog) {
    throw new NotFoundError('Blog');
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

  return res.status(200).json({
    success: true,
    message: 'Blog deleted successfully',
    data: deleted
  });
});