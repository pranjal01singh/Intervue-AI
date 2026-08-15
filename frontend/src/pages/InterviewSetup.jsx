import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { interviewTracks } from "../data/interviewTracks";
import Button from "../components/Button";
import { uploadResume, startInterview } from "../services/interviewService";

const modes = [
  {
    id: "easy",
    label: "Easy",
    duration: "20 min",
    description: "Fundamentals only. Great for warm-up.",
    questionRange: "8-10",
  },
  {
    id: "medium",
    label: "Medium",
    duration: "40 min",
    description: "Balanced mix of concepts and problem solving.",
    questionRange: "12-15",
  },
  {
    id: "hard",
    label: "Hard",
    duration: "60 min",
    description: "Deep dives, system design, edge cases.",
    questionRange: "18-20",
  },
];

const StepIndicator = ({ step }) => (
  <div className="flex flex-wrap items-center gap-2 rounded-full bg-slate-900/80 px-3 py-2 text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.18em] text-slate-500">
    <span
      className={`rounded-full border px-2 py-1 sm:px-3 sm:py-1 ${step === 1 ? "border-indigo-500 text-white" : "border-slate-700 text-slate-500"}`}
    >
      Steps
    </span>
    <span
      className={`hidden sm:inline ${step > 1 ? "text-white" : "text-slate-500"}`}
    >
      Track
    </span>
    <span className="hidden sm:inline mx-1 text-slate-700">—</span>
    <span
      className={`hidden sm:inline ${step > 1 ? "text-white" : "text-slate-500"}`}
    >
      Resume
    </span>
    <span className="hidden sm:inline mx-1 text-slate-700">—</span>
    <span
      className={`hidden sm:inline ${step > 2 ? "text-white" : "text-slate-500"}`}
    >
      Mode
    </span>
    <span className="sm:hidden text-xs">{step}/3</span>
  </div>
);

const InterviewSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedTrackIdFromState = location.state?.selectedTrackId;
  const [step, setStep] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState(
    interviewTracks.find((track) => track.id === selectedTrackIdFromState) ||
      interviewTracks[0],
  );
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeUrl, setResumeUrl] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [startError, setStartError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedMode, setSelectedMode] = useState(modes[1]);

  const selectedTrackLabel = useMemo(
    () => selectedTrack?.title || "Full Stack Dev",
    [selectedTrack],
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      setResumeFile(null);
      setResumeUrl(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Resume must be 5MB or smaller.");
      setResumeFile(null);
      setResumeUrl(null);
      return;
    }

    setUploadError("");
    setResumeFile(file);
    setResumeUrl(null);
  };

  const handleUploadResume = async () => {
    if (!resumeFile) {
      setUploadError("Please select a PDF resume before continuing.");
      return false;
    }

    if (resumeUrl) {
      return true;
    }

    try {
      setIsUploading(true);
      setUploadError("");
      const data = await uploadResume(resumeFile);
      setResumeUrl(data.resumeUrl);
      return true;
    } catch (error) {
      setUploadError(
        error.response?.data?.message ||
          "Resume upload failed. Please try again.",
      );
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const handleContinue = async () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      const uploaded = await handleUploadResume();
      if (!uploaded) {
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      const interviewStarted = await handleStartInterview();
      if (interviewStarted) {
        // `handleStartInterview` navigates to the live interview page itself.
        // Prevent navigating back to the dashboard here.
      }
    }
  };

  const handleStartInterview = async () => {
    if (!resumeUrl) {
      setStartError("Please upload your resume before starting the interview.");
      return false;
    }

    try {
      setIsStarting(true);
      setStartError("");
      const data = await startInterview({
        trackId: selectedTrack.id,
        trackTitle: selectedTrack.title,
        mode: selectedMode.id,
        resumeUrl,
      });
      // navigate to live interview with interview data
      navigate("/interview/live", { state: { interview: data.interview } });
      return true;
    } catch (error) {
      setStartError(
        error.response?.data?.message ||
          "Unable to start the interview. Please try again.",
      );
      return false;
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-3 sm:px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 shadow-xl shadow-slate-950/30">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.24em] text-indigo-400">
              AI Mock Interview Platform
            </p>
            <h1 className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold text-white">
              Set up your interview
            </h1>
          </div>
          <Link
            to="/dashboard"
            className="text-xs sm:text-sm font-medium text-slate-400 hover:text-white whitespace-nowrap"
          >
            ← Back to dashboard
          </Link>
        </div>

        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <StepIndicator step={step} />
          <div className="text-[11px] sm:text-sm text-slate-500 hidden sm:block">
            Click to preview each screen
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-8 shadow-2xl shadow-slate-950/20">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex-shrink-0">
              <i className="fa-solid fa-layer-group" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest sm:tracking-[0.24em] text-slate-500">
                {step === 1 ? "Track" : step === 2 ? "Resume" : "Mode"}
              </p>
              <h2 className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-white">
                {step === 1 && "Confirm your track"}
                {step === 2 && "Upload your resume"}
                {step === 3 && "Choose difficulty"}
              </h2>
              <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm leading-5 sm:leading-6 text-slate-400">
                {step === 1 &&
                  "You can switch role before starting. Dashboard se jo choose kiya tha wo already selected hoga."}
                {step === 2 &&
                  "AI will read your projects and skills to generate personalized questions."}
                {step === 3 && "Medium recommended for most candidates."}
              </p>
            </div>
          </div>

          {step === 1 && (
            <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2">
              {interviewTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  className={`group rounded-2xl sm:rounded-3xl border p-4 sm:p-6 text-left transition ${
                    selectedTrack.id === track.id
                      ? "border-indigo-500 bg-slate-950/90"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
                  }`}
                >
                  <div className="mb-3 sm:mb-5 flex items-center justify-between">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-800 text-base sm:text-lg text-white flex-shrink-0">
                      <i className={track.iconClass} />
                    </div>
                    {selectedTrack.id === track.id && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.18em] text-white whitespace-nowrap">
                        Selected
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white">
                    {track.title}
                  </h3>
                  <p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-5 sm:leading-6 text-slate-400">
                    {track.description}
                  </p>
                  <div className="mt-4 sm:mt-6 flex items-center justify-between text-xs sm:text-sm text-slate-400">
                    <span className="rounded-full bg-slate-800/80 px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.18em] text-slate-300">
                      {track.difficulty}
                    </span>
                    <span>{track.questionRange} Q</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="relative block rounded-2xl sm:rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-6 sm:p-10 text-center transition hover:border-indigo-500 hover:bg-slate-900/80">
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={handleFileChange}
                />
                <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-slate-800 text-xl sm:text-2xl text-white">
                  <i className="fa-solid fa-file-arrow-up" />
                </div>
                <p className="mt-4 sm:mt-6 text-base sm:text-lg font-semibold text-white">
                  Drop your resume here
                </p>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-400">
                  or click to browse • PDF only • max 5 MB
                </p>
              </label>
              {uploadError && (
                <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-rose-400">
                  {uploadError}
                </p>
              )}
              {resumeFile && !resumeUrl && !uploadError && (
                <div className="mt-4 sm:mt-6 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4 text-slate-300">
                  <p className="font-semibold text-white text-sm sm:text-base">
                    Resume ready to upload
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-400">
                    {resumeFile.name}
                  </p>
                </div>
              )}
              {resumeUrl && (
                <div className="mt-4 sm:mt-6 rounded-2xl sm:rounded-3xl border border-emerald-600 bg-slate-950/70 p-3 sm:p-4 text-slate-300">
                  <p className="font-semibold text-emerald-400 text-sm sm:text-base">
                    Resume uploaded
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-400">
                    {resumeFile?.name}
                  </p>
                </div>
              )}
              <div className="mt-4 sm:mt-6 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/70 p-3 sm:p-4 text-slate-300">
                <p className="font-semibold text-sm sm:text-base">
                  Your resume is private
                </p>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Only used to generate interview questions. Not stored
                  permanently or shared with anyone.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="space-y-3 sm:space-y-4">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`w-full rounded-2xl sm:rounded-3xl border p-4 sm:p-6 text-left transition ${
                      selectedMode.id === mode.id
                        ? "border-indigo-500 bg-slate-950/90"
                        : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base font-semibold text-white">
                          <span
                            className={`inline-flex h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 rounded-full flex-shrink-0 ${
                              mode.id === "easy"
                                ? "bg-emerald-500"
                                : mode.id === "medium"
                                  ? "bg-indigo-500"
                                  : "bg-rose-500"
                            }`}
                          />
                          {mode.label}
                        </div>
                        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-400">
                          {mode.description}
                        </p>
                      </div>
                      <div className="text-right text-xs sm:text-sm text-slate-400 flex-shrink-0">
                        <div>{mode.duration}</div>
                        <div className="mt-1 sm:mt-2 text-white">
                          {mode.questionRange} Q
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 sm:mt-8 rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-950/70 p-4 sm:p-6 text-slate-300">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-widest sm:tracking-[0.24em] text-slate-500">
                      Track
                    </p>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white break-words">
                      {selectedTrackLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest sm:tracking-[0.24em] text-slate-500">
                      Resume
                    </p>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-emerald-400 break-all">
                      {resumeFile?.name || "resume.pdf"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest sm:tracking-[0.24em] text-slate-500">
                      Mode
                    </p>
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white">
                      {selectedMode.label}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 sm:mt-8 flex flex-col gap-2 sm:gap-3">
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
              <Button
                variant="danger"
                className="w-full sm:w-auto rounded-lg sm:rounded-2xl px-4 py-2.5 sm:py-3 text-sm"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                ← Back
              </Button>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {step === 3 && startError && (
                  <p className="text-xs sm:text-sm text-rose-400 line-clamp-2">
                    {startError}
                  </p>
                )}
                {step < 3 ? (
                  <Button
                    className="w-full sm:w-auto rounded-lg sm:rounded-2xl bg-indigo-600 px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-white hover:bg-indigo-500"
                    onClick={handleContinue}
                    loading={isUploading}
                  >
                    {step === 1
                      ? "Continue to resume"
                      : "Upload resume & continue"}
                  </Button>
                ) : (
                  <Button
                    className="w-full sm:w-auto rounded-lg sm:rounded-2xl bg-indigo-600 px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-white hover:bg-indigo-500"
                    onClick={handleContinue}
                    loading={isStarting}
                  >
                    Start interview →
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default InterviewSetup;
