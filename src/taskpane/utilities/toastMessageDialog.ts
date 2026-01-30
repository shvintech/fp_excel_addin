import { DialogMessageArgs } from "./type";

export const toastMessageDialog = (type: string, message: string): Promise<Office.Dialog> => {
  return new Promise((resolve, reject) => {
    const encodedType = encodeURIComponent(type);
    const encodedMessage = encodeURIComponent(message);

    const url = `${window.location.origin}/toastMessage.html?type=${encodedType}&msg=${encodedMessage}`;
    Office.context.ui.displayDialogAsync(
      url,
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
