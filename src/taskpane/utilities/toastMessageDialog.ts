import { DialogMessageArgs } from "./type";

export const toastMessageDialog = (type: string, message: string): Promise<Office.Dialog> => {
  return new Promise((resolve, reject) => {
    const encodedType = encodeURIComponent(type);
    const encodedMessage = encodeURIComponent(message);

    Office.context.ui.displayDialogAsync(
      `https://fp-exceladdin-dev.shvintech.com/toastMessage.html?type=${encodedType}&msg=${encodedMessage}`,
      { height: 40, width: 50 },
      (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
          const dialog = asyncResult.value;
          const autoCloseTimer = setTimeout(() => {
            dialog.close();
          }, 5000);

          dialog.addEventHandler(
            Office.EventType.DialogMessageReceived,
            (arg: DialogMessageArgs) => {
              console.log("Message from dialog:", arg.message);
              clearTimeout(autoCloseTimer);
              dialog.close();
            }
          );

          resolve(dialog);
        } else {
          console.error("Dialog failed to open:", asyncResult.error);
          reject(asyncResult.error);
        }
      }
    );
  });
};
