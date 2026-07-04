// lib/toast.js
import toast from "react-hot-toast";

/**
 * Advanced Toast Notification System
 * Provides enhanced toast notifications with multiple variants and features
 */

const defaultStyles = {
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: "500",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  maxWidth: "500px",
};

export const notify = {
  /**
   * Success notification
   */
  success: (message, options = {}) => {
    return toast.success(message, {
      duration: options.duration || 4000,
      style: {
        background: "#10b981",
        color: "#ffffff",
        ...defaultStyles,
        ...options.style,
      },
      iconTheme: {
        primary: "#ffffff",
        secondary: "#10b981",
      },
      ...options,
    });
  },

  /**
   * Error notification
   */
  error: (message, options = {}) => {
    return toast.error(message, {
      duration: options.duration || 5000,
      style: {
        background: "#ef4444",
        color: "#ffffff",
        ...defaultStyles,
        ...options.style,
      },
      iconTheme: {
        primary: "#ffffff",
        secondary: "#ef4444",
      },
      ...options,
    });
  },

  /**
   * Warning notification
   */
  warning: (message, options = {}) => {
    return toast(message, {
      duration: options.duration || 4000,
      icon: "⚠️",
      style: {
        background: "#f59e0b",
        color: "#ffffff",
        ...defaultStyles,
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Info notification
   */
  info: (message, options = {}) => {
    return toast(message, {
      duration: options.duration || 4000,
      icon: "ℹ️",
      style: {
        background: "#3b82f6",
        color: "#ffffff",
        ...defaultStyles,
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Loading notification with promise handling
   */
  loading: (message, options = {}) => {
    return toast.loading(message, {
      style: {
        background: "#ffffff",
        color: "#000000",
        ...defaultStyles,
        ...options.style,
      },
      ...options,
    });
  },

  /**
   * Promise-based notification
   * Automatically shows loading, success, and error states
   */
  promise: (promise, messages = {}, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || "Loading...",
        success: messages.success || "Success!",
        error: messages.error || "Error occurred",
      },
      {
        style: defaultStyles,
        success: {
          duration: 4000,
          style: {
            background: "#10b981",
            color: "#ffffff",
          },
          iconTheme: {
            primary: "#ffffff",
            secondary: "#10b981",
          },
        },
        error: {
          duration: 5000,
          style: {
            background: "#ef4444",
            color: "#ffffff",
          },
          iconTheme: {
            primary: "#ffffff",
            secondary: "#ef4444",
          },
        },
        loading: {
          style: {
            background: "#6b7280",
            color: "#ffffff",
          },
        },
        ...options,
      },
    );
  },

  /**
   * Custom notification with action button
   */
  action: (message, actionText, onAction, options = {}) => {
    return toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">{message}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => {
                onAction();
                toast.dismiss(t.id);
              }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
            >
              {actionText}
            </button>
          </div>
        </div>
      ),
      {
        duration: options.duration || 6000,
        ...options,
      },
    );
  },

  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss: (toastId) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  },

  /**
   * Custom toast with full control
   */
  custom: (message, options = {}) => {
    return toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}
        >
          <div className="flex-1">
            <p className="text-sm text-gray-900">{message}</p>
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-500"
          >
            ✕
          </button>
        </div>
      ),
      options,
    );
  },

  /**
   * Persistent notification (doesn't auto-dismiss)
   */
  persistent: (message, type = "info", options = {}) => {
    const types = {
      success: () =>
        notify.success(message, { duration: Infinity, ...options }),
      error: () => notify.error(message, { duration: Infinity, ...options }),
      warning: () =>
        notify.warning(message, { duration: Infinity, ...options }),
      info: () => notify.info(message, { duration: Infinity, ...options }),
    };

    return types[type] ? types[type]() : types.info();
  },
};

/**
 * Utility functions for toast management
 */
export const toastUtils = {
  /**
   * Clear all active toasts
   */
  clearAll: () => toast.dismiss(),

  /**
   * Check if a toast is active
   */
  isActive: (toastId) => {
    // Note: react-hot-toast doesn't provide a built-in way to check this
    // You'd need to maintain your own state if you need this functionality
    return false;
  },

  /**
   * Update an existing toast
   */
  update: (toastId, message, options = {}) => {
    toast.dismiss(toastId);
    return toast(message, options);
  },
};

export default notify;
