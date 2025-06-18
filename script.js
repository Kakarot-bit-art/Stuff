document.addEventListener('DOMContentLoaded', () => {
    // Select elements
    const timelineEvents = document.querySelectorAll('.timeline-event');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');
    const carouselItems = document.querySelectorAll('.carousel-item');
    const imageCarousel = document.querySelector('.image-carousel');
    // timelineContainer isn't used for scrolling control in JS now, only CSS scroll-behavior
    const timelineContainer = document.querySelector('.timeline-container'); // Re-added selector as it's used for centering

    // Music Player Elements
    const backgroundMusic = document.getElementById('background-music');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const muteUnmuteBtn = document.getElementById('mute-unmute-btn');

    let currentIndex = 0;
    let isPlaying = false; // Tracks desired state, doesn't perfectly mirror audio.paused immediately
    let isMuted = false; // Tracks desired state

    // --- Function to set aspect ratio for carousel items ---
    function setAspectRatio(imgElement, itemElement) {
        // Check for valid natural dimensions
        if (!imgElement || imgElement.naturalWidth <= 0 || imgElement.naturalHeight <= 0 || isNaN(imgElement.naturalWidth) || isNaN(imgElement.naturalHeight)) {
             console.warn('Invalid natural dimensions for image or img element missing:', imgElement ? imgElement.src : 'N/A', '. w:', imgElement ? imgElement.naturalWidth : 'N/A', ', h:', imgElement ? imgElement.naturalHeight : 'N/A');
             // Fallback to a default ratio (e.g., 1:1 square or 16:9) and potentially style error
             itemElement.style.setProperty('--aspect-ratio', '1 / 1'); // Defaulting to square
             itemElement.classList.add('aspect-ratio-error'); // Optional: add a class to style invalid ratio items
             return;
        }
        // Set the CSS variable using the format 'width / height' which aspect-ratio property understands
        itemElement.style.setProperty('--aspect-ratio', `${imgElement.naturalWidth} / ${imgElement.naturalHeight}`);
         // console.log('Set aspect ratio for', imgElement.src, 'to', `${imgElement.naturalWidth} / ${imgElement.naturalHeight}`);
    }

    // --- Load Images and Set Aspect Ratios, then Initialize ---
    let imagesProcessedCount = 0;
    const totalExpectedItems = carouselItems.length;

    // Add a state to prevent multiple initializations if load/error events fire unexpectedly
    let initialSetupCompleted = false;

    // Iterate through carousel items to handle image loading
    carouselItems.forEach(item => {
        const img = item.querySelector('img');
        if (img) {
            const processItem = () => {
                // Avoid double processing the same item if both load and error somehow fire
                if (item.dataset.processed) return;
                item.dataset.processed = 'true'; // Mark as processed

                setAspectRatio(img, item); // Calculate and set aspect ratio CSS variable
                imagesProcessedCount++;
                // Check if all items have been processed (either loaded or errored)
                if (imagesProcessedCount === totalExpectedItems && !initialSetupCompleted) {
                    initialSetupCompleted = true; // Mark setup is starting
                    // All items have attempted loading, now perform initial setup
                    // console.log("All carousel items processed. Performing initial setup.");
                    performInitialSetup();
                }
            };

            // Handle cached images and network images
             // Check for img.complete and non-zero dimensions for cached or already loaded images
            if (img.complete && img.naturalHeight !== 0 && img.naturalWidth !== 0) {
                 processItem();
            } else {
                // Use `once: true` to automatically remove listener after it fires
                img.addEventListener('load', processItem, { once: true });
                img.addEventListener('error', () => {
                    console.warn('Error loading image:', img.src);
                     // Ensure error also counts towards processing total
                    processItem(); // Call processItem which will also increment count and check for completion
                    item.classList.add('image-load-error'); // Add class to style load errors
                }, { once: true });
            }
        } else {
             // Item exists but has no image - treat as processed with default ratio
             console.warn("Carousel item found without a direct <img> child:", item);
             if (!item.dataset.processed) { // Avoid double processing if somehow processItem gets called elsewhere
                  item.dataset.processed = 'true';
                  imagesProcessedCount++; // Count this item towards total processed
                   item.style.setProperty('--aspect-ratio', '1 / 1'); // Set a default ratio for consistency
                   if (imagesProcessedCount === totalExpectedItems && !initialSetupCompleted) {
                       initialSetupCompleted = true; // Mark setup is starting
                       performInitialSetup();
                   }
             }
        }
    });


     // --- Function for initial setup after images are processed ---
     // This function is called ONLY when all images have loaded or failed to load.
     function performInitialSetup() {
         // Validate the counts *before* proceeding
         if (timelineEvents.length === 0 || carouselItems.length === 0 || timelineEvents.length !== carouselItems.length) {
             console.error(`Initialization failed: Timeline events (${timelineEvents.length}) and carousel items (${carouselItems.length}) mismatch or missing.`);
              // Disable navigation/timeline if initialization fails
              leftArrow.style.display = 'none';
              rightArrow.style.display = 'none';
              // Also potentially hide the timeline container and carousel?
              if(imageCarousel) imageCarousel.style.display = 'none';
              if(timelineContainer) timelineContainer.style.display = 'none';
             return; // Stop initialization
         }

         // Determine the initial index based on HTML 'active' class, default to 0
         const initialActiveEvent = document.querySelector('.timeline-event.active');
         let initialIndexToUse = 0; // Default

         if (initialActiveEvent) {
             const htmlIndex = parseInt(initialActiveEvent.dataset.index);
              // Validate index against the actual number of items
             if (!isNaN(htmlIndex) && htmlIndex >= 0 && htmlIndex < carouselItems.length) {
                  initialIndexToUse = htmlIndex;
             } else {
                  console.warn("Initial active timeline event index in HTML is invalid or out of bounds. Defaulting to index 0.");
                   // If invalid active class is found, remove it to avoid confusion
                   initialActiveEvent.classList.remove('active');
                    carouselItems.forEach(item => item.classList.remove('active')); // Remove active from carousel too
             }
         } // If no active class in HTML, initialIndexToUse remains 0

         // Update to the determined initial index - This sets the initial active state and scrolls
         // Do this *after* validating all items exist etc.
         updateTimeline(initialIndexToUse);


         // === Music Autoplay Attempt ===
         // Music functionality requires the audio element and a source
         const audioSource = backgroundMusic.querySelector('source');
         let canPlayMusic = false;

         // Check if there's a source with an src value (and not just the page URL if src is empty)
         // Also ensure loop attribute exists for this simple implementation
         if (audioSource && audioSource.src && audioSource.src !== window.location.href && backgroundMusic.loop !== undefined) {
             canPlayMusic = true;
             backgroundMusic.volume = 0.5; // Set a default volume
             // console.log("Music source detected and appears valid.");

              // Attempt autoplay ONLY after DOM is ready and potentially after a required user gesture.
              // Browsers typically block autoplay with sound without a user gesture.
              // We'll attempt it in response to the *first* user interaction event below.
              // This flag will be set to true on the first click on play button, arrow, or timeline event.
         } else {
             // console.warn("Background music source not set or 'loop' attribute is missing or source src is empty/same as page. Music player potentially disabled or limited.");
             // Disable buttons if no valid music source
              playPauseBtn.disabled = true;
              muteUnmuteBtn.disabled = true;
              canPlayMusic = false;
         }


          // Flag to ensure we only attach user interaction listeners ONCE
          // and only attempt the FIRST playback on user interaction.
          // A boolean flag indicating if a user interaction relevant to playback control has happened
          let playbackUserGestureReceived = false;

          // Function to handle user gesture and initiate playback attempt
          const handleUserGesturePlayback = () => {
               // Only proceed if music is enabled, a gesture hasn't been processed for playback unlock yet
               if (!canPlayMusic || playbackUserGestureReceived || playPauseBtn.disabled) {
                    // console.log(`handleUserGesturePlayback: blocked. CanPlay: ${canPlayMusic}, GestureReceived: ${playbackUserGestureReceived}, BtnDisabled: ${playPauseBtn.disabled}`);
                    return;
               }

               // console.log("User gesture detected. Attempting music playback.");
               playbackUserGestureReceived = true; // Mark gesture received to prevent multiple attempts from subsequent clicks

               attemptMusicPlay(); // Attempt to play the music now
          };


          // Attach passive event listeners for common interaction types that unlock playback
          // Adding listeners to document for broad capture, but could refine to specific areas like container or buttons
          document.body.addEventListener('click', handleUserGesturePlayback, { once: true });
          document.body.addEventListener('touchstart', handleUserGesturePlayback, { once: true });
           // Consider 'touchend', 'mousedown', 'mouseup', 'mousemove'? Click is usually sufficient.

           // Initial attempt in setup is NOT reliable for autoplay.
           // The call to updateTimeline happens here, setting the initial state,
           // the music play attempt will wait for user gesture or manual button press.

     }


    // --- Function to attempt music playback ---
    // This function initiates play *if* conditions are met (like canPlayMusic, gesture received)
    // It does NOT decide *when* to play (that's for button listeners and gesture handler)
    function attemptMusicPlay() {
         // Check basic readiness (audio source exists and is usable, player not disabled)
        if (!canPlayMusic || playPauseBtn.disabled) {
            console.log("Attempt to play blocked: music source invalid or disabled.");
             return;
        }
        // Note: This function is designed to be called after a user gesture
        // Or by a direct user click on the play/pause button.
        // Browser policy requiring gesture is handled by the .play() promise rejection.


         // Don't attempt play if it's already playing AND not muted
        if (!backgroundMusic.paused && !backgroundMusic.muted) {
            // console.log("Attempt to play blocked: music is already playing.");
            // Ensure icon is correct if somehow out of sync
            playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
            isPlaying = true; // Reflect the playing state
            return;
        }

        // Now, try to play (handles resume if paused)
        backgroundMusic.play().then(() => {
            // Playback started successfully (or was resumed)
            console.log("Music playback attempt successful.");
             isPlaying = true;
             // Update icon to pause
            if (!backgroundMusic.muted) { // Only show pause icon if music is audible
                playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
            }
             // The `playbackUserGestureReceived` flag handles the *first* unlock
             // `hasUserInteracted` isn't strictly necessary anymore if all interactions lead to `attemptMusicPlay`
        }).catch(e => {
             // Playback failed or was rejected (e.g., by browser policy needing a user gesture)
             console.warn("Music playback failed:", e.message || e);
              isPlaying = false; // State is paused if play failed
              playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play'); // Ensure play icon is shown
             // If this attempt failed, it might be due to a missing gesture.
             // Subsequent user clicks/touches should now enable playback thanks to `handleUserGesturePlayback`.
        });
    }


     // --- Function to update the timeline and carousel display ---
     // This function handles navigation (setting active class and scrolling)
    function updateTimeline(newIndex) {
        // Ensure newIndex is within the valid range of carousel items (and thus timeline events)
        // Check against timelineEvents.length as it was validated in performInitialSetup
        if (newIndex < 0 || newIndex >= timelineEvents.length) {
             // console.warn(`Navigation index ${newIndex} is out of bounds (0 to ${timelineEvents.length - 1}).`);
             return; // Exit if index is invalid (no wrapping implemented currently)
        }

        // Remove active class from the previously active item (if any)
        // Check if currentIndex is within bounds before attempting to remove class
        if (currentIndex >= 0 && currentIndex < timelineEvents.length) {
             // Check if elements actually exist before trying to remove class
             if (timelineEvents[currentIndex]) timelineEvents[currentIndex].classList.remove('active');
             if (carouselItems[currentIndex]) carouselItems[currentIndex].classList.remove('active');
        }

        // Update the current index
        currentIndex = newIndex;

        // Add active class to the new item
        // Check if elements actually exist before trying to add class
        if (timelineEvents[currentIndex]) timelineEvents[currentIndex].classList.add('active');
        if (carouselItems[currentIndex]) carouselItems[currentIndex].classList.add('active');


        // Scroll the active timeline event into the center of its container
        if (timelineEvents[currentIndex] && timelineContainer) {
            // Scroll timelineContainer itself
            // Calculate center position relative to container's scroll position
             const timelineScrollPos = timelineEvents[currentIndex].offsetLeft - timelineContainer.offsetWidth / 2 + timelineEvents[currentIndex].offsetWidth / 2;

             timelineContainer.scrollTo({
                left: timelineScrollPos,
                behavior: 'smooth'
             });

             // Alternatively, simpler approach using scrollIntoView, but centering is less reliable
             // timelineEvents[currentIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }


         // Scroll the active image carousel item into the center of its container
         if (carouselItems[currentIndex] && imageCarousel) {
              const carouselScrollPos = carouselItems[currentIndex].offsetLeft - imageCarousel.offsetWidth / 2 + carouselItems[currentIndex].offsetWidth / 2;
               imageCarousel.scrollTo({
                 left: carouselScrollPos,
                 behavior: 'smooth'
              });
             // Alternative using scrollIntoView
             // carouselItems[currentIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' });
         }
    }


     // --- Event Listeners ---

    // Add click listeners to timeline events
    timelineEvents.forEach((event, index) => {
         // Assuming the index is reliable now after validation in performInitialSetup
         event.addEventListener('click', () => {
            // Use the loop index as the primary source of truth
            updateTimeline(index);
             // Clicking a timeline event is a user gesture. Attempt playback.
             attemptMusicPlay(); // Call the main attempt function
         });
    });

    // Add click listeners to navigation arrows
    leftArrow.addEventListener('click', () => {
        updateTimeline(currentIndex - 1);
         attemptMusicPlay(); // Clicking an arrow is a user gesture. Attempt playback.
    });

    rightArrow.addEventListener('click', () => {
        updateTimeline(currentIndex + 1);
         attemptMusicPlay(); // Clicking an arrow is a user gesture. Attempt playback.
    });

    // Music player controls
    playPauseBtn.addEventListener('click', () => {
         // Clicking the play/pause button is a user gesture. Attempt playback if paused.
        if (backgroundMusic.paused) {
             attemptMusicPlay(); // Call the main attempt function
        } else {
            // If currently playing (or trying to play), just pause directly
            backgroundMusic.pause();
            playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
            isPlaying = false;
             console.log("Music paused via button click.");
        }
         // Ensure the gesture flag is set by button click
         playbackUserGestureReceived = true;
    });

     muteUnmuteBtn.addEventListener('click', () => {
         // Muting/unmuting is a user interaction gesture.
         playbackUserGestureReceived = true; // Mark gesture received

        if (backgroundMusic.muted) { // Was muted, now unmuting
            backgroundMusic.muted = false;

              // If it was supposed to be playing (based on `isPlaying` state which was set when `play()` was called successfully), try to resume audible playback
              if (isPlaying && backgroundMusic.paused) { // if isPlaying state is true, but actual audio element is paused (maybe browser auto-paused it on mute)
                  backgroundMusic.play().then(() => {
                         console.log("Music resumed after unmuting.");
                         // Ensure icon is pause now that it's unmuted and playing
                         playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
                    }).catch(e => {
                         console.warn("Music resume after unmuting failed:", e.message || e);
                         // Keep the play icon
                         playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
                         isPlaying = false; // Mark not playing if resume fails
                    });
              } else if (!backgroundMusic.paused) {
                   // It was already playing silently, just update the icon if needed
                    playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
                     isPlaying = true; // State is indeed playing
              }


             muteUnmuteBtn.querySelector('i').classList.replace('fa-volume-mute', 'fa-volume-up');
             isMuted = false;
             console.log("Music unmuted.");

        } else { // Was unmuted, now muting
             // Set muted state
            backgroundMusic.muted = true;

             // Update state and icon
             // No need to call pause here, setting muted to true might handle that internally or music plays silently.
             muteUnmuteBtn.querySelector('i').classList.replace('fa-volume-up', 'fa-volume-mute');
             isMuted = true;
              console.log("Music muted.");
               // Icon on play/pause button should probably remain 'pause' if it was playing before muting, unless muting forces pause and you want that reflected.
               // Let's assume muting keeps the playback state unless browser forces pause.
               // If it's actually paused now due to mute, icon should become play.
                if (backgroundMusic.paused) {
                     playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
                     isPlaying = false; // Reflect the new state
                }
        }
     });

     // Listen for actual 'play' and 'pause' events on the audio element to sync state/icons
     backgroundMusic.addEventListener('play', () => {
         isPlaying = true;
         // Update icon only if not muted
         if (!backgroundMusic.muted) {
             playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
         }
          // console.log("Audio 'play' event fired. isPlaying = true.");
     });

      backgroundMusic.addEventListener('pause', () => {
          isPlaying = false;
           playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
            // console.log("Audio 'pause' event fired. isPlaying = false.");
      });
      backgroundMusic.addEventListener('volumechange', () => {
           // Sync mute state icon with actual muted property if user mutes via system controls
           isMuted = backgroundMusic.muted;
           if (backgroundMusic.muted) {
                 muteUnmuteBtn.querySelector('i').classList.replace('fa-volume-up', 'fa-volume-mute');
           } else {
                muteUnmuteBtn.querySelector('i').classList.replace('fa-volume-mute', 'fa-volume-up');
           }
           // If audio starts playing (due to gesture) while mute icon is showing, update play/pause icon
           if (!backgroundMusic.paused && !backgroundMusic.muted && playPauseBtn.querySelector('i').classList.contains('fa-play')) {
                playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
           } else if (!backgroundMusic.paused && backgroundMusic.muted && playPauseBtn.querySelector('i').classList.contains('fa-pause')) {
                // Music playing silently, play icon might be better
                // Decide behavior: should icon reflect play state or audible state?
                // Let's keep it reflecting play state: pause icon means audio.paused=false
           }

           // console.log(`Audio 'volumechange' fired. Muted: ${backgroundMusic.muted}`);
      });


    // Initial setup (Triggered after all images are processed)
    // The image loading loop triggers performInitialSetup() which starts everything.
    // Music autoplay waits for first user gesture or explicit button press.

});