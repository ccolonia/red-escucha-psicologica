import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // Allow unauthenticated uploads only for registration (CV upload)
    // The file is validated and stored with a random name

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Solo se permiten archivos PDF o Word" }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar los 10MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".docx");
    const uniqueName = `${crypto.randomBytes(16).toString("hex")}${ext}`;

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "cv");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    const cvUrl = `/uploads/cv/${uniqueName}`;

    return NextResponse.json({ cvUrl, fileName: file.name });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
