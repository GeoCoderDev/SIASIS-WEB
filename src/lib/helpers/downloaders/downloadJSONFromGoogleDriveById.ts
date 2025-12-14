export async function downloadJSONFromGoogleDriveById<T>(
  googleDriveId: string
): Promise<T> {
  const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;
  
  const response = await fetch(url);
  
  return await response.json();
}
