export function useAttachmentUrl() {
  const api = useUserApi();

  function attachmentUrl(itemId: string, attachmentId: string): string {
    return api.items.authURL(`/api/v1/items/${itemId}/attachments/${attachmentId}`);
  }

  function thumbnailUrl(itemId: string): string | null {
    return api.items.authURL(`/api/v1/items/${itemId}/attachments/thumbnail`);
  }

  return { attachmentUrl, thumbnailUrl };
}
