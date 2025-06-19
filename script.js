document.addEventListener('DOMContentLoaded', () => {
    // Select elements
    const timelineEvents = document.querySelectorAll('.timeline-event');
    const leftArrow = document.querySelector('.left-arrow');
    const rightArrow = document.querySelector('.right-arrow');
    // Select the new card elements
    const imageCardList = document.querySelector('.image-card-list'); // Select the list container
    const imageCards = document.querySelectorAll('.image-card'); // Select all individual cards

    const timelineContainer = document.querySelector('.timeline-container');

    // Music Player Elements
    const backgroundMusic = document.getElementById('background-music');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const muteUnmuteBtn = document.getElementById('mute-unmute-btn');

    let currentIndex = 0;
    let isPlaying = false; // Tracks desired state, doesn't perfectly mirror audio.paused immediately
    let isMuted = false; // Tracks desired state


    // --- Function to set aspect ratio for image container/card if needed (less critical with object-fit: cover) ---
    function setAspectRatio(imgElement, itemElement) {
        // This function is now less critical visually because object-fit: cover is used
        // on the img with a fixed height. But keeping it could be useful for fallbacks
        // or other layouts where the container aspect ratio matters.
        if (!imgElement || imgElement.naturalWidth <= 0 || imgElement.naturalHeight <= 0 || isNaN(imgElement.naturalWidth) || isNaN(imgElement.naturalHeight)) {
             console.warn('Invalid natural dimensions for image or img element missing:', imgElement ? imgElement.src : 'N/A', '. w:', imgElement ? imgElement.naturalWidth : 'N/A', ', h:', imgElement ? imgElement.naturalHeight : 'N/A');
             // Setting a default ratio on the *card* itself is likely less useful now
             // Consider styling the *image element* differently on error if object-fit: cover fails
             // itemElement.style.setProperty('--aspect-ratio', '1 / 1'); // Defaulting to square (less relevant)
             // itemElement.classList.add('aspect-ratio-error'); // Class for the *card* if image fails
             return; // Don't set variable if invalid
        }
         // Keep setting the variable, but its CSS usage has changed or removed
        itemElement.style.setProperty('--aspect-ratio', `${imgElement.naturalWidth} / ${imgElement.naturalHeight}`);
         // console.log('Set aspect ratio for', imgElement.src, 'to', `${imgElement.naturalWidth} / ${imgElement.naturalHeight}`);
    }

    // --- Load Images and potentially Set Aspect Ratios, then Initialize ---
    let imagesProcessedCount = 0;
    const totalExpectedItems = imageCards.length; // Use imageCards length

    // Add a state to prevent multiple initializations
    let initialSetupCompleted = false;

    // Iterate through carousel items to handle image loading
    imageCards.forEach(card => {
        const img = card.querySelector('img');
        if (img) {
            const processCard = () => {
                // Avoid double processing the same card
                if (card.dataset.processed) return;
                card.dataset.processed = 'true'; // Mark as processed

                setAspectRatio(img, card); // Calculate and set aspect ratio CSS variable (optional based on visual need)
                imagesProcessedCount++;
                // Check if all items have been processed (either loaded or errored)
                if (imagesProcessedCount === totalExpectedItems && !initialSetupCompleted) {
                    initialSetupCompleted = true; // Mark setup is starting
                    // console.log("All image cards processed. Performing initial setup.");
                    performInitialSetup();
                }
            };

             // Check for img.complete and non-zero dimensions
            if (img.complete && img.naturalHeight !== 0 && img.naturalWidth !== 0) {
                 processCard();
            } else {
                // Use `once: true` to automatically remove listener
                img.addEventListener('load', processCard, { once: true });
                img.addEventListener('error', () => {
                    console.warn('Error loading image:', img.src);
                    processCard(); // Call processCard to increment count and check for completion
                    card.classList.add('image-load-error'); // Add class to style load errors
                     // Set alt text explicitly if it's missing or generic
                     if (!img.alt || img.alt === 'Placeholder image for event X.') { // Basic check
                         img.alt = 'Image failed to load';
                     }
                     // For object-fit:cover height, ensure error text/icon fits
                }, { once: true });
            }
        } else {
             // Item exists but has no image - treat as processed with default styling/error state
             console.warn("Image card found without a direct <img> child.");
             if (!card.dataset.processed) { // Avoid double processing
                  card.dataset.processed = 'true';
                  imagesProcessedCount++; // Count this item towards total processed
                   card.classList.add('image-load-error'); // Add class to style missing image cards
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
         // Use imageCards.length now instead of carouselItems.length
         if (timelineEvents.length === 0 || imageCards.length === 0 || timelineEvents.length !== imageCards.length) {
             console.error(`Initialization failed: Timeline events (${timelineEvents.length}) and image cards (${imageCards.length}) mismatch or missing.`);
              // Disable navigation/timeline if initialization fails
              leftArrow.style.display = 'none';
              rightArrow.style.display = 'none';
              if(imageCardList) imageCardList.style.display = 'none';
              if(timelineContainer) timelineContainer.style.display = 'none';
             return; // Stop initialization
         }

         // Determine the initial index based on HTML 'active' class, default to 0
         const initialActiveEvent = document.querySelector('.timeline-event.active');
         let initialIndexToUse = 0; // Default

         if (initialActiveEvent) {
             const htmlIndex = parseInt(initialActiveEvent.dataset.index);
              // Validate index against the actual number of items
             if (!isNaN(htmlIndex) && htmlIndex >= 0 && htmlIndex < imageCards.length) {
                  initialIndexToUse = htmlIndex;
             } else {
                  console.warn("Initial active timeline event index in HTML is invalid or out of bounds. Defaulting to index 0.");
                   // If invalid active class is found, remove it
                   initialActiveEvent.classList.remove('active');
                    imageCards.forEach(card => card.classList.remove('active')); // Remove active from cards too
             }
         } // If no active class in HTML, initialIndexToUse remains 0


         // === Add Click Listener to Image Cards ===
         // Now that initial setup confirms elements exist and are matched
         imageCards.forEach((card, index) => {
              card.addEventListener('click', () => {
                   // When a card is clicked, update the timeline to its index
                   updateTimeline(index);
                   // Clicking a card is a user gesture. Attempt playback.
                   attemptMusicPlay(); // Call the main attempt function
              });
         });

         // Update to the determined initial index - This sets the initial active state and scrolls
         updateTimeline(initialIndexToUse);


         // === Music Autoplay Attempt ===
         const audioSource = backgroundMusic.querySelector('source');
         let canPlayMusic = false;

         if (audioSource && audioSource.src && audioSource.src !== window.location.href && backgroundMusic.loop !== undefined) {
             canPlayMusic = true;
             backgroundMusic.volume = 0.5;
             console.log("Music source detected and appears valid. Player initialized.");
         } else {
              console.warn("Background music source not set or invalid. Music player disabled.");
              playPauseBtn.disabled = true;
              muteUnmuteBtn.disabled = true;
              canPlayMusic = false;
         }


          let playbackUserGestureReceived = false;

          const handleUserGesturePlayback = () => {
               if (!canPlayMusic || playbackUserGestureReceived || playPauseBtn.disabled) {
                    // console.log(`handleUserGesturePlayback: blocked. CanPlay: ${canPlayMusic}, GestureReceived: ${playbackUserGestureReceived}, BtnDisabled: ${playPauseBtn.disabled}`);
                    return;
               }
               console.log("User gesture detected. Attempting music playback.");
               playbackUserGestureReceived = true; // Mark gesture received
               attemptMusicPlay(); // Attempt to play
          };

          // Add passive event listeners to unlock playback on first interaction
           document.body.addEventListener('click', handleUserGesturePlayback, { once: true, passive: true });
           document.body.addEventListener('touchstart', handleUserGesturePlayback, { once: true, passive: true });

           // Initial attempt is NOT guaranteed to work due to policies. Play will happen on first interaction.
     }


    // --- Function to attempt music playback ---
    function attemptMusicPlay() {
        if (!canPlayMusic || playPauseBtn.disabled) {
            console.log("Attempt to play blocked: music source invalid or disabled.");
            return;
        }

         // Only try to play if currently paused.
         // If not paused (i.e., playing), the logic shouldn't try to call play again,
         // and the icon state should be correct based on the 'play' event listener.
         if (!backgroundMusic.paused) {
             //console.log("Attempt to play blocked: audio is not paused.");
             // Ensure icon is correct if somehow out of sync, but don't try playing.
              if (!backgroundMusic.muted) {
                  playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
               } else {
                   // If playing but muted, decide which icon you prefer (play state vs audible state)
                   // Let's keep it showing play state: 'pause' icon if playing silently
                    playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
               }
             isPlaying = true;
             return;
         }


        // Now, try to play (this will resume if paused)
        backgroundMusic.play().then(() => {
            console.log("Music playback attempt successful.");
             isPlaying = true;
             // Update icon to pause only if audible
            if (!backgroundMusic.muted) {
                playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
            } else {
                 // Playing silently
                 playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
            }
        }).catch(e => {
             console.warn("Music playback failed:", e.message || e);
              isPlaying = false;
              // Ensure play icon is shown as play failed
              playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
              // Reset the gesture flag if this *user-initiated* play failed.
              // This allows the next user interaction to attempt play again.
              // Check if e.name is known autoplay related, but simpler to just reset.
              playbackUserGestureReceived = false;
        });
    }


     // --- Function to update the timeline and card display ---
     // This function handles navigation (setting active class and scrolling)
    function updateTimeline(newIndex) {
        // Use imageCards.length now for bounds check
        if (newIndex < 0 || newIndex >= imageCards.length) {
             // console.warn(`Navigation index ${newIndex} is out of bounds (0 to ${imageCards.length - 1}).`);
             return;
        }

        // Remove active class from the previously active item
        // Check if currentIndex is within bounds
        if (currentIndex >= 0 && currentIndex < imageCards.length) {
             if (timelineEvents[currentIndex]) timelineEvents[currentIndex].classList.remove('active');
             if (imageCards[currentIndex]) imageCards[currentIndex].classList.remove('active');
        }

        // Update the current index
        currentIndex = newIndex;

        // Add active class to the new item
        if (timelineEvents[currentIndex]) timelineEvents[currentIndex].classList.add('active');
        if (imageCards[currentIndex]) imageCards[currentIndex].classList.add('active');


        // Scroll the active timeline event into the center of its container horizontally
        if (timelineEvents[currentIndex] && timelineContainer) {
             const timelineScrollPos = timelineEvents[currentIndex].offsetLeft - timelineContainer.offsetWidth / 2 + timelineEvents[currentIndex].offsetWidth / 2;
             timelineContainer.scrollTo({
                left: timelineScrollPos,
                behavior: 'smooth'
             });
        }

         // Scroll the active image card into the center of the viewport vertically
         // This uses the built-in scrollIntoView method with 'block: center'
         if (imageCards[currentIndex]) {
             imageCards[currentIndex].scrollIntoView({
                 behavior: 'smooth',
                 block: 'center' // 'center' tries to align the center of the element with the center of the scrollable area.
             });
         }
    }


     // --- Event Listeners ---

    // Add click listeners to timeline events
    timelineEvents.forEach((event, index) => {
         event.addEventListener('click', () => {
            updateTimeline(index);
             // Clicking a timeline event is a user gesture. Attempt playback.
            attemptMusicPlay();
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


    // Music player controls (Simplified slightly)
    playPauseBtn.addEventListener('click', () => {
        // Toggle state and attempt play or pause directly
        if (backgroundMusic.paused) {
             console.log("Play button clicked, attempting to play...");
             attemptMusicPlay(); // Try to play/resume via the attempt function
        } else {
            console.log("Pause button clicked, pausing...");
            backgroundMusic.pause(); // Directly pause if currently playing
            // The 'pause' event listener will update isPlaying and the icon
        }
         // Button click is a user gesture
         playbackUserGestureReceived = true;
    });

     muteUnmuteBtn.addEventListener('click', () => {
        // Muting/unmuting is a user interaction gesture.
        playbackUserGestureReceived = true; // Mark gesture received

        backgroundMusic.muted = !backgroundMusic.muted; // Toggle mute state
        // Icon/state update is handled by the 'volumechange' event listener
         console.log(`Mute button clicked, muted: ${backgroundMusic.muted}`);
     });

     // Listen for actual 'play' and 'pause' events on the audio element to sync state/icons
     // These are the source of truth for audio state
     backgroundMusic.addEventListener('play', () => {
         console.log("Audio 'play' event fired.");
         isPlaying = true;
         // Update icon only if audio is audible (not muted)
         if (!backgroundMusic.muted) {
             playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
         } else {
             // Decide: if playing silently, show pause icon? Or show play because user expects audio?
             // Let's stick to showing pause icon if audio.paused is false, regardless of mute.
              playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
         }
     });

      backgroundMusic.addEventListener('pause', () => {
          console.log("Audio 'pause' event fired.");
          isPlaying = false;
           playPauseBtn.querySelector('i').classList.replace('fa-pause', 'fa-play');
      });

      backgroundMusic.addEventListener('volumechange', () => {
           // console.log(`Audio 'volumechange' fired. Muted: ${backgroundMusic.muted}`);
           isMuted = backgroundMusic.muted;
           // Sync mute icon
           if (backgroundMusic.muted) {
                 muteUnmuteBtn.querySelector('i').classList.replace('fa-volume-up', 'fa-volume-mute');
           } else {
                muteUnmuteBtn.querySelector('i').classList.replace('fa-volume-mute', 'fa-volume-up');
           }

           // Also check if the play/pause icon needs updating based on mute state changing
           if (!backgroundMusic.paused) { // If audio is playing (audible or silent)
              if (!backgroundMusic.muted) {
                 // Music became audible, ensure pause icon shows
                  playPauseBtn.querySelector('i').classList.replace('fa-play', 'fa-pause');
              } else {
                 // Music became silent, ensure pause icon still shows (reflects playing state)
                 // No change needed if already pause icon
              }
           }
            // If paused, play icon is already showing by the 'pause' event listener
      });

     // Initial setup (Triggered after all images are processed/attempted)
     // The image loading loop triggers performInitialSetup() which starts everything.
     // Music autoplay awaits the first user gesture (click/touch) via the added listeners.

});
