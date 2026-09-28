import React, { useState, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import Header from "../_components/Header";

const BugPage = ({
  theme,
  onThemeChange,
  auth,
  onOpenAuth,
  onLogout,
  onBack,
}) => {
  const fileInputRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    category: "",
    urgency: "",
    message: "",
    issue_date: "",
  });
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setAttachments(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Add submit/API logic here
    console.log("Submitted Data:", formData, attachments);

    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <>    
      <div className="h-full w-full bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header section (kept intact) */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <button
          onClick={onBack}
          type="button"
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Report a Bug
        </h1>
      </div>

      {/* Main Content Form */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
        <div className="px-4 py-6 sm:py-8 sm:px-8">
          

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Select */}
            <div className="space-y-3">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Complaint category <span className="text-red-600/80">*</span>
              </label>
              <select
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="shadow border !mt-3 w-full px-3 py-2 rounded cursor-pointer"
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
                <div className="text-red-500 text-sm">{errors.category}</div>
              )}
            </div>

            {/* Urgency Level Select */}
            <div className="space-y-3">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Urgency level <span className="text-red-600/80">*</span>
              </label>
              <select
                name="urgency"
                required
                value={formData.urgency}
                onChange={handleChange}
                className="shadow border !mt-3 w-full px-3 py-2 rounded cursor-pointer"
              >
                <option value="">e.g., Low, Medium, High, Critical...</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              {errors.urgency && (
                <div className="text-red-500 text-sm">{errors.urgency}</div>
              )}
            </div>

            {/* Message Description */}
            <div className="word_count relative space-y-3">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">
                Describe the complaint{" "}
                <span className="text-red-600/80">*</span>
              </label>
              <textarea
                name="message"
                maxLength={1000}
                required
                rows={4}
                value={formData.message}
                onChange={handleChange}
                placeholder="Please provide detailed information, steps to reproduce, and any error messages..."
                className="rounded shadow border cursor-pointer !mt-3 min-h-30 resize-none w-full p-3"
              ></textarea>
              <div className="absolute bottom-4 right-4 text-base text-secondaryDark">
                <span className="limit">{formData.message.length}</span>/1000
              </div>
              {errors.message && (
                <div className="text-red-500 text-sm">{errors.message}</div>
              )}
            </div>

            {/* Date Input */}
            <div className="space-y-3">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">When did this occur</label>
              <div className="relative">
                <input
                  type="date"
                  id="when_occur"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleChange}
                  className="shadow !mt-3 p-3 border w-full"
                />
                {/* <div className="absolute h-fit inset-y-0 top-1/2 right-4 flex items-center pointer-events-none text-gray-400">
                  <svg
                    width="15"
                    height="16"
                    viewBox="0 0 15 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M0 14.5C0 15.3281 0.684182 16 1.52748 16H12.729C13.5723 16 14.2564 15.3281 14.2564 14.5V6H0V14.5ZM10.1832 8.375C10.1832 8.16875 10.355 8 10.565 8H11.8379C12.048 8 12.2198 8.16875 12.2198 8.375V9.625C12.2198 9.83125 12.048 10 11.8379 10H10.565C10.355 10 10.1832 9.83125 10.1832 9.625V8.375ZM10.1832 12.375C10.1832 12.1687 10.355 12 10.565 12H11.8379C12.048 12 12.2198 12.1687 12.2198 12.375V13.625C12.2198 13.8313 12.048 14 11.8379 14H10.565C10.355 14 10.1832 13.8313 10.1832 13.625V12.375ZM6.1099 8.375C6.1099 8.16875 6.28174 8 6.49177 8H7.76467C7.97469 8 8.14653 8.16875 8.14653 8.375V9.625C8.14653 9.83125 7.97469 10 7.76467 10H6.49177C6.28174 10 6.1099 9.83125 6.1099 9.625V8.375ZM6.1099 12.375C6.1099 12.1687 6.28174 12 6.49177 12H7.76467C7.97469 12 8.14653 12.1687 8.14653 12.375V13.625C8.14653 13.8313 7.97469 14 7.76467 14H6.49177C6.28174 14 6.1099 13.8313 6.1099 13.625V12.375ZM2.03663 8.375C2.03663 8.16875 2.20847 8 2.4185 8H3.6914C3.90143 8 4.07327 8.16875 4.07327 8.375V9.625C4.07327 9.83125 3.90143 10 3.6914 10H2.4185C2.20847 10 2.03663 9.83125 2.03663 9.625V8.375ZM2.03663 12.375C2.03663 12.1687 2.20847 12 2.4185 12H3.6914C3.90143 12 4.07327 12.1687 4.07327 12.375V13.625C4.07327 13.8313 3.90143 14 3.6914 14H2.4185C2.20847 14 2.03663 13.8313 2.03663 13.625V12.375ZM12.729 2H11.2015V0.5C11.2015 0.225 10.9724 0 10.6923 0H9.67401C9.39397 0 9.16485 0.225 9.16485 0.5V2H5.09158V0.5C5.09158 0.225 4.86246 0 4.58243 0H3.56411C3.28407 0 3.05495 0.225 3.05495 0.5V2H1.52748C0.684182 2 0 2.67188 0 3.5V5H14.2564V3.5C14.2564 2.67188 13.5723 2 12.729 2Z"
                      fill="#A1A1A1"
                    ></path>
                  </svg>
                </div> */}
              </div>
            </div>

            {/* Attachment Dropzone */}
            <div className="space-y-3">
              <label className="inline-flex font-semibold text-sm capitalize items-center gap-1">Attachments</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="shadow min-h-30 h-auto border border-dashed border-fourGrey rounded-xl p-4 hover:border-secondaryDark bg-white/50 dark:bg-gray-800/50 flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                {attachments.length > 0 && (
                  <ul className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                    {attachments.map((file, i) => (
                      <li key={i}>{file.name}</li>
                    ))}
                  </ul>
                )}
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
                    <path
                      d="M32 32L24 24L16 32"
                      stroke="#878787"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                  <div className="space-y-2">
                    <p className="text-base text-primaryText dark:text-gray-200 font-medium">
                      Drag &amp; drop files or{" "}
                      <span className="text-primaryLight underline">
                        Browse
                      </span>
                    </p>
                    <p className="text-xs text-secondaryText dark:text-gray-400 tracking-tight">
                      PDF, JPG, PNG | Max 25MB each
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
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
    </>
  );
};

export default BugPage;
