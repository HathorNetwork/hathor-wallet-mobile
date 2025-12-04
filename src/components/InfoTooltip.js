/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Image, Touchable, View } from 'react-native';
import infoCircle from '../assets/icons/info-circle.png';

function InfoTooltip({ children, tooltipContent }) {
  const [isTooltipShown, setIsTooltipShown] = useState(false);
  const [pressLocation, setPressLocation] = useState({ x: 0, y: 0 });

  const handlePressIn = (event) => {
    setPressLocation({ x: event.pageX, y: event.pageY });
    setIsTooltipShown(true);
  };

  const handlePressOut = () => {
    setIsTooltipShown(false);
  };

  return (
    <Touchable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ position: 'relative', display: 'inline-block' }} // Ensure children are positioned correctly
    >
      {children}
      <Image source={infoCircle} width={24} height={24} />
      {isTooltipShown && (
        <View
          className="tooltip"
          style={{
            position: 'absolute',
            top: pressLocation.y + 10, // Adjust offset as needed
            left: pressLocation.x + 10, // Adjust offset as needed
            backgroundColor: 'black',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            zIndex: 1000,
          }}
        >
          {tooltipContent}
        </View>
      )}
    </Touchable>
  );
}

export default InfoTooltip;
