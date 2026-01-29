/**
 * Show loading dialog
 */
export const showLoadingDialog = async (): Promise<Office.Dialog> => {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      window.location.origin + "/loading-dialog.html",
      { height: 30, width: 40, displayInIframe: true },
      (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Failed) {
          console.error("Loading dialog failed: " + asyncResult.error.message);
          reject(asyncResult.error);
          return;
        }

        const dialog = asyncResult.value;
        resolve(dialog);
      }
    );
  });
};

/**
 * Update loading dialog message
 */
export const updateLoadingDialog = (
  dialog: Office.Dialog,
  message: string,
  enableClose: boolean = false
) => {
  try {
    dialog.messageChild(JSON.stringify({ message, enableClose }));
  } catch (error: unknown) {
    console.error("Error updating loading dialog:", error);
  }
};

/**
 * Execute operation with automatic loading dialog management
 * Handles dialog lifecycle, errors, and cleanup automatically
 */
export const withLoadingDialog = async <T>(
  operation: (dialog: Office.Dialog) => Promise<T>,
  initialMessage: string = "Processing..."
): Promise<T | null> => {
  let dialog: Office.Dialog | null = null;

  try {
    dialog = await showLoadingDialog();
    updateLoadingDialog(dialog, initialMessage);

    const result = await operation(dialog);
    return result;
  } catch (error: unknown) {
    console.error("Operation failed:", error);
    if (dialog) {
      const errorMessage =
        error instanceof Error && error.message ? error.message : "Unknown error occurred";
      updateLoadingDialog(dialog, `Error: ${errorMessage}`, true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw error;
  } finally {
    if (dialog) {
      try {
        dialog.close();
      } catch (e) {
        // Dialog might already be closed
        console.warn("Dialog close warning:", e);
      }
    }
  }
};
