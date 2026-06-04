import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { google, type drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { env } from "../env.js";

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string;
  webContentLink: string;
  modifiedTime?: string | null;
}

export function getDriveClient(): drive_v3.Drive {
  const credentialsPath = path.resolve(process.cwd(), "credentials.json");

  if (fs.existsSync(credentialsPath)) {
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth });
  }

  const oauthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  oauthClient.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauthClient });
}

export async function crearCarpeta(nombre: string, parentFolderId?: string | null): Promise<DriveFolder> {
  const drive = getDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentFolderId ? [parentFolderId] : undefined,
    },
    fields: "id,name",
  });

  return { id: response.data.id ?? "", name: response.data.name ?? nombre };
}

export async function listarArchivos(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,webViewLink,webContentLink,modifiedTime)",
  });

  return (response.data.files ?? []).map(toDriveFile);
}

export async function buscarCarpetaPorNombre(nombre: string, parentFolderId: string): Promise<DriveFolder | null> {
  const drive = getDriveClient();
  const escapedName = nombre.replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name)",
    pageSize: 1,
  });

  const folder = response.data.files?.[0];
  return folder?.id ? { id: folder.id, name: folder.name ?? nombre } : null;
}

export async function subirArchivo(
  fileBuffer: Buffer,
  nombre: string,
  mimeType: string,
  folderId: string
): Promise<DriveFile> {
  return subirArchivoStream(Readable.from(fileBuffer), nombre, mimeType, folderId);
}

export async function subirArchivoStream(
  body: Readable,
  nombre: string,
  mimeType: string,
  folderId: string
): Promise<DriveFile> {
  const drive = getDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: nombre,
      parents: [folderId],
    },
    media: {
      mimeType,
      body,
    },
    fields: "id,name,mimeType,size,webViewLink,webContentLink,modifiedTime",
  });

  return toDriveFile(response.data);
}

export async function eliminarArchivo(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.update({ fileId, requestBody: { trashed: true } });
}

export async function obtenerArchivo(fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size,webViewLink,webContentLink,modifiedTime",
  });

  return toDriveFile(response.data);
}

export async function compartirCarpeta(fileId: string, email: string, role: "writer" | "reader"): Promise<void> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId,
    requestBody: {
      type: "user",
      role,
      emailAddress: email,
    },
    sendNotificationEmail: false,
  });
}

function toDriveFile(file: drive_v3.Schema$File): DriveFile {
  return {
    id: file.id ?? "",
    name: file.name ?? "",
    mimeType: file.mimeType ?? "application/octet-stream",
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink ?? "",
    webContentLink: file.webContentLink ?? "",
    modifiedTime: file.modifiedTime,
  };
}
