import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional(),
});

export const patchWorkspaceSchema = z.object({
  action: z.enum(["trash", "restore", "rename"]),
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional().nullable(),
});

export const createBoardSchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

export const patchBoardSchema = z.object({
  action: z.enum(["trash", "restore", "rename"]),
  name: z.string().min(1).max(200).trim().optional(),
});

export const uploadInitSchema = z.object({
  fileName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  totalSize: z.number().int().min(0),
  boardId: z.string().min(1),
});

export const uploadCompleteSchema = z.object({
  totalChunks: z.number().int().min(1),
});

export const s3CompleteSchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  parts: z.array(
    z.object({
      PartNumber: z.number().int().min(1),
      ETag: z.string().min(1),
    })
  ).min(1),
});
