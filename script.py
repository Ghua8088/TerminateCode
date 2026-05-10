from youtube_transcript_api import YouTubeTranscriptApi

# Fetch and combine transcript text
transcript_list = YouTubeTranscriptApi.get_transcript("QwShVo0zfuk")
full_transcript = " ".join([entry['text'] for entry in transcript_list])
print(full_transcript)