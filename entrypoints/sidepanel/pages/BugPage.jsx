import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, X, FileText } from "lucide-react";
import { DEALERCORE_CONFIG } from "../../../utils/dealercore-config";

const BugPage = ({ onBack, auth }) => {
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    category: "",
    urgency: "",
    message: "",
    issue_date: "",
  });
  const [attachments, setAttachments] = useState([]); // Array of File objects
  const [previews, setPreviews] = useState([]); // Array of { file, previewUrl, isImage }
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null

  // Generate previews when attachments change
  useEffect(() => {
    const newPreviews = attachments.map((file) => {
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      return { file, previewUrl, isImage };
    });

    setPreviews(newPreviews);

    // Cleanup object URLs to avoid memory leaks
    return () => {
      newPreviews.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, [attachments]);

  // Field change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Append new files without duplicates
  const handleFilesAdded = (newFiles) => {
    const fileArray = Array.from(newFiles);
    setAttachments((prev) => {
      const existingNames = new Set(prev.map((f) => f.name + f.size));
      const filteredNew = fileArray.filter(
        (f) => !existingNames.has(f.name + f.size)
      );
      return [...prev, ...filteredNew];
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
      // Reset input value so re-selecting the same file triggers onChange
      e.target.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Remove a specific file from attachments
  const handleRemoveFile = (indexToRemove, e) => {
    e.stopPropagation(); // Stop click from triggering the file input dialog
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  // Validation logic
  const validate = () => {
    const newErrors = {};

    if (!formData.category) {
      newErrors.category = "Please select a complaint category.";
    }
    if (!formData.urgency) {
      newErrors.urgency = "Please select an urgency level.";
    }
    if (!formData.message.trim()) {
      newErrors.message = "Please describe the issue in detail.";
    } else if (formData.message.trim().length < 10) {
      newErrors.message = "Description should be at least 10 characters.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const payload = new FormData();
      payload.append("type", "report_issue");
      payload.append("category", formData.category);
      payload.append("urgency", formData.urgency);
      payload.append("message", formData.message);
      payload.append("issue_date", formData.issue_date || "");
      payload.append("user_id", auth?.user?.id || "79");

      // Append files
      attachments.forEach((file) => {
        payload.append("attachments[]", file);
      });

      const response = await fetch(`${DEALERCORE_CONFIG.DEFAULT_DOMAIN}/api/admin/ask`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth?.token || "YOUR_BEARER_TOKEN"}`,
        },
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const result = await response.json();
      console.log("Response:", result);

      setSubmitStatus("success");
      setFormData({ category: "", urgency: "", message: "", issue_date: "" });
      setAttachments([]);
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden text-gray-900 dark:text-gray-100">
      {/* Header section */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <button
          onClick={onBack}
          type="button"
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-bold">Report a Bug</h1>
      </div>

      {/* Main Content Form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
        <div className="px-4 py-6 sm:py-8 sm:px-8">
          {submitStatus === "success" && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800 rounded-lg text-sm">
              Your issue report has been submitted successfully!
            </div>
          )}

          {submitStatus === "error" && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 rounded-lg text-sm">
              Failed to submit report. Please check your connection and try again.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Category Select */}
            <div className="space-y-2">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Complaint category <span className="text-red-600/80">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`shadow border ${
                  errors.category
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-700"
                } bg-white dark:bg-gray-800 w-full px-3 py-2 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500`}
              >
                <option value="">
                  e.g., System bug, Data issue, Compliance issue...
                </option>
                <option value="System bug">System bug</option>
                <option value="Data issue">Data issue</option>
                <option value="Compliance issue">Compliance issue</option>
                <option value="Integration problem">Integration problem</option>
                <option value="Billing/Account">Billing/Account</option>
                <option value="Reporting">Reporting</option>
                <option value="Other">Other</option>
              </select>
              {errors.category && (
                <div className="text-red-500 text-xs mt-1">{errors.category}</div>
              )}
            </div>

            {/* Urgency Level Select */}
            <div className="space-y-2">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Urgency level <span className="text-red-600/80">*</span>
              </label>
              <select
                name="urgency"
                value={formData.urgency}
                onChange={handleChange}
                className={`shadow border ${
                  errors.urgency
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-700"
                } bg-white dark:bg-gray-800 w-full px-3 py-2 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500`}
              >
                <option value="">e.g., Low, Medium, High, Critical...</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              {errors.urgency && (
                <div className="text-red-500 text-xs mt-1">{errors.urgency}</div>
              )}
            </div>

            {/* Message Description */}
            <div className="word_count relative space-y-2">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Describe the complaint <span className="text-red-600/80">*</span>
              </label>
              <textarea
                name="message"
                maxLength={1000}
                rows={4}
                value={formData.message}
                onChange={handleChange}
                placeholder="Please provide detailed information, steps to reproduce, and any error messages..."
                className={`rounded shadow border ${
                  errors.message
                    ? "border-red-500"
                    : "border-gray-300 dark:border-gray-700"
                } bg-white dark:bg-gray-800 min-h-[120px] resize-none w-full p-3 focus:outline-none focus:ring-2 focus:ring-sky-500`}
              ></textarea>
              <div className="absolute bottom-4 right-4 text-xs text-gray-400 pointer-events-none">
                <span>{formData.message.length}</span>/1000
              </div>
              {errors.message && (
                <div className="text-red-500 text-xs mt-1">{errors.message}</div>
              )}
            </div>

            {/* Date Input */}
            <div className="space-y-2">
              <label
                htmlFor="when_occur"
                className="inline-flex font-semibold text-sm capitalize items-center gap-1"
              >
                When did this occur
              </label>
              <input
                type="date"
                id="when_occur"
                name="issue_date"
                value={formData.issue_date}
                onChange={handleChange}
                className="shadow p-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded w-full focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Attachment Dropzone & Previews */}
            <div className="space-y-2">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Attachments
              </label>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="shadow min-h-[120px] h-auto border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 hover:border-gray-500 dark:hover:border-gray-400 bg-white/50 dark:bg-gray-800/50 flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                <div className="upload_placeholder flex items-center gap-3 pointer-events-none">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M32 32L24 24L16 32"
                      stroke="#878787"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                    <path
                      d="M24 24V42"
                      stroke="#878787"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                    <path
                      d="M40.7809 36.779C42.7316 35.7155 44.2726 34.0328 45.1606 31.9962C46.0487 29.9597 46.2333 27.6855 45.6853 25.5324C45.1373 23.3793 43.8879 21.47 42.1342 20.1059C40.3806 18.7418 38.2226 18.0005 36.0009 17.999H33.4809C32.8755 15.6575 31.7472 13.4837 30.1808 11.641C28.6144 9.79829 26.6506 8.33469 24.4371 7.36021C22.2236 6.38572 19.818 5.92571 17.4011 6.01476C14.9843 6.1038 12.619 6.73959 10.4833 7.87432C8.34747 9.00905 6.49672 10.6132 5.07014 12.5662C3.64356 14.5191 2.67828 16.7701 2.24686 19.1498C1.81544 21.5295 1.92911 23.9761 2.57932 26.3055C3.22954 28.635 4.39938 30.7867 6.0009 32.599"
                      stroke="#878787"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                  <div className="space-y-2">
                    <p className="text-base text-gray-800 dark:text-gray-200 font-medium">
                      Drag &amp; drop files or{" "}
                      <span className="text-sky-500 underline">Browse</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tracking-tight">
                      PDF, JPG, PNG | Max 25MB each
                    </p>
                  </div>
                </div>
              </div>

              {/* Attachment Previews Grid */}
              {previews.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-3 mt-3">
                  {previews.map((item, index) => (
                    <div
                      key={index}
                      className="relative group border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800/80 flex flex-col items-center justify-between h-28 text-center"
                    >
                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveFile(index, e)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow transition-transform transform hover:scale-110 z-10"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Image or File Icon Preview */}
                      <div className="flex-1 flex items-center justify-center overflow-hidden w-full max-h-16 my-1">
                        {item.isImage ? (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="max-h-full max-w-full object-contain rounded"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                            <FileText className="w-8 h-8 stroke-1" />
                          </div>
                        )}
                      </div>

                      {/* File Name & Size */}
                      <div className="w-full">
                        {/* <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate w-full px-1">
                          {item.file.name}
                        </p> */}
                        <p className="text-[10px] text-gray-400">
                          {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 !mt-8">
              <button
                onClick={onBack}
                type="button"
                className="text-sm w-full bg-white dark:bg-gray-800 border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-sm w-full bg-[#00a2e8] hover:bg-[#008bc9] text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                disabled={loading}
              >
                {loading && (
                  <svg
                    className="w-5 h-5 animate-spin"
                    viewBox="0 0 16 16"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                  >
                    <path
                      d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"
                      opacity=".2"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                    <path
                      d="M7.25.75A.75.75 0 018 0a8 8 0 018 8 .75.75 0 01-1.5 0A6.5 6.5 0 008 1.5a.75.75 0 01-.75-.75z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                )}
                Report Issue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BugPage;