export const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            // Remove data:application/pdf;base64, prefix
            // reader.result looks like "data:audio/mp3;base64,AAAA..."
            resolve(reader.result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
};
