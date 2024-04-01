import * as React from 'react'
import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg'
import { BaseIcon } from './Base.icon';

/**
 * @param {SvgProps|{type: 'default'|'outline'|'fill'}} props
 *
 * @description
 * Svg converted from Figma using transaformer at https://react-svgr.com/playground/?native=true
 */
export const ReceivedIcon = (props) => (
  <BaseIcon type={props.type || 'default'}>
    <Svg
      xmlns='http://www.w3.org/2000/svg'
      width={24}
      height={24}
      fill='none'
      {...props}
    >
      <G clipPath='url(#a)'>
        <Path
          fill={props.color || 'hsla(180, 85%, 34%, 1)'}
          fillRule='evenodd'
          d='M7.822 17.77h5.924a.75.75 0 1 1 0 1.5H5.261v-8.486a.75.75 0 0 1 1.5 0v5.925L17.678 5.79a.75.75 0 0 1 1.06 1.061L7.823 17.769Z'
          clipRule='evenodd'
        />
      </G>
      <Defs>
        <ClipPath id='a'>
          <Path
            fill={props.color || '#fff'}
            d='M0 0h24v24H0z'
          />
        </ClipPath>
      </Defs>
    </Svg>
  </BaseIcon>
);
