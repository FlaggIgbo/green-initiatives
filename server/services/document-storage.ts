/**
 * Document Storage Service Skeleton
 * TODO: Implement actual storage logic using Google Cloud Storage or AWS S3.
 */

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
}

export class DocumentStorageService {
  /**
   * Generates a pre-signed URL for document upload.
   * @param fileName Name of the file to be uploaded
   * @param contentType MIME type of the file
   * @returns Pre-signed URL and public URL for the file
   */
  async getPreSignedUploadUrl(
    fileName: string,
    _contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    // TODO: Implement integration with GCS or S3
    // 1. Initialize Cloud Storage client (Google Cloud Storage recommended)
    // 2. Define bucket: gs://berrybank-greeninitiatives-docs
    // 3. Generate V4 signed URL with expiration (e.g., 15 minutes)
    // 4. Return both the signed upload URL and the final public URL
    return {
      uploadUrl: `https://storage.googleapis.com/upload/${fileName}?token=mock-token`,
      publicUrl: `https://storage.googleapis.com/green-initiatives-docs/${fileName}`,
    };
  }

  /**
   * Verifies if a document exists and is accessible.
   * @param _url Public URL of the document
   */
  async verifyDocument(_url: string): Promise<boolean> {
    // TODO: Implement verification logic
    return true;
  }
}

export const documentStorageService = new DocumentStorageService();
